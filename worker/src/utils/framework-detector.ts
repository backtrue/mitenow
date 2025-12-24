/**
 * Framework Detection Utility
 * Analyzes uploaded ZIP contents to detect the framework type
 * 
 * Improved version using proper ZIP parsing instead of string search
 */

import type { Env, FrameworkType, ZipAnalysisResult } from '../types';
import { ApiError } from '../types';

// ============================================
// Constants
// ============================================

const MAX_ZIP_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILE_READ_SIZE = 1 * 1024 * 1024; // 1MB for individual files

// Valid framework types that can be used as overrides
const VALID_FRAMEWORKS: FrameworkType[] = [
  'streamlit', 'gradio', 'flask', 'fastapi',
  'react', 'nextjs', 'express', 'static'
];

// ============================================
// Main Analysis Function
// ============================================

/**
 * Analyze app framework from R2 stored files
 * Uses proper ZIP parsing to detect the framework type
 */
export async function analyzeAppFramework(
  env: Env,
  appId: string,
  overrideFramework?: string
): Promise<ZipAnalysisResult> {
  // If framework is explicitly specified and valid, use it
  if (overrideFramework && VALID_FRAMEWORKS.includes(overrideFramework as FrameworkType)) {
    const framework = overrideFramework as FrameworkType;
    return {
      framework,
      entrypoint: getDefaultEntrypoint(framework),
      has_requirements: isPythonFramework(framework),
      files: []
    };
  }

  console.log(`[Framework] Auto-detecting framework for ${appId}...`);

  // Get the source.zip path
  const sourceKey = `uploads/${appId}/source.zip`;
  const sourceObject = await env.MITE_BUCKET.head(sourceKey);

  if (!sourceObject) {
    console.log(`[Framework] No source found, defaulting to streamlit`);
    return defaultResult('streamlit');
  }

  // Check custom metadata for framework hint
  const metadataFramework = sourceObject.customMetadata?.framework as FrameworkType | undefined;
  if (metadataFramework && VALID_FRAMEWORKS.includes(metadataFramework)) {
    console.log(`[Framework] Using metadata hint: ${metadataFramework}`);
    return {
      framework: metadataFramework,
      entrypoint: getDefaultEntrypoint(metadataFramework),
      has_requirements: isPythonFramework(metadataFramework),
      files: []
    };
  }

  // Read and analyze ZIP file
  const sourceData = await env.MITE_BUCKET.get(sourceKey);
  if (!sourceData) {
    return defaultResult('streamlit');
  }

  const zipBuffer = await sourceData.arrayBuffer();

  // Check size limit
  if (zipBuffer.byteLength > MAX_ZIP_SIZE) {
    throw new ApiError(400, 'ZIP file too large for analysis');
  }

  try {
    const result = await detectFrameworkFromZip(zipBuffer);
    console.log(`[Framework] Detected: ${result.framework}, requirements: ${result.hasRequirements}, package.json: ${result.hasPackageJson}`);

    return {
      framework: result.framework,
      entrypoint: getDefaultEntrypoint(result.framework),
      has_requirements: result.hasRequirements,
      has_package_json: result.hasPackageJson,
      files: result.files
    };
  } catch (error) {
    console.error('[Framework] Detection failed:', error);
    return defaultResult('streamlit');
  }
}

// ============================================
// ZIP Parsing
// ============================================

interface ZipDetectionResult {
  framework: FrameworkType;
  hasRequirements: boolean;
  hasPackageJson: boolean;
  files: string[];
  requirementsContent?: string;
  packageJsonContent?: string;
}

/**
 * Detect framework by properly parsing ZIP file structure
 * Uses the ZIP Central Directory for reliable file listing
 */
async function detectFrameworkFromZip(buffer: ArrayBuffer): Promise<ZipDetectionResult> {
  const bytes = new Uint8Array(buffer);

  // Parse ZIP Central Directory to get file list
  const files = parseZipCentralDirectory(bytes);

  // Extract key files content
  let requirementsContent = '';
  let packageJsonContent = '';

  // Look for requirements.txt
  const requirementsFile = files.find(f =>
    f.name === 'requirements.txt' || f.name.endsWith('/requirements.txt')
  );
  if (requirementsFile && requirementsFile.uncompressedSize < MAX_FILE_READ_SIZE) {
    requirementsContent = extractFileContent(bytes, requirementsFile);
  }

  // Look for package.json
  const packageJsonFile = files.find(f =>
    f.name === 'package.json' || f.name.endsWith('/package.json')
  );
  if (packageJsonFile && packageJsonFile.uncompressedSize < MAX_FILE_READ_SIZE) {
    packageJsonContent = extractFileContent(bytes, packageJsonFile);
  }

  const hasRequirements = !!requirementsContent;
  const hasPackageJson = !!packageJsonContent;

  // Detect framework based on file contents
  const framework = detectFrameworkType(
    files.map(f => f.name),
    requirementsContent,
    packageJsonContent
  );

  return {
    framework,
    hasRequirements,
    hasPackageJson,
    files: files.map(f => f.name),
    requirementsContent,
    packageJsonContent
  };
}

interface ZipFileEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  localHeaderOffset: number;
}

/**
 * Parse ZIP Central Directory to get file list
 * This is more reliable than searching the entire file
 */
function parseZipCentralDirectory(bytes: Uint8Array): ZipFileEntry[] {
  const entries: ZipFileEntry[] = [];

  // Find End of Central Directory (EOCD) signature: 0x06054b50
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4B &&
      bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    console.warn('[ZIP] Could not find End of Central Directory');
    return entries;
  }

  // Read EOCD
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const centralDirSize = view.getUint32(eocdOffset + 12, true);
  const centralDirOffset = view.getUint32(eocdOffset + 16, true);

  // Parse Central Directory entries
  let offset = centralDirOffset;
  const endOffset = centralDirOffset + centralDirSize;

  while (offset < endOffset && offset < bytes.length - 46) {
    // Check Central Directory File Header signature: 0x02014b50
    if (bytes[offset] !== 0x50 || bytes[offset + 1] !== 0x4B ||
      bytes[offset + 2] !== 0x01 || bytes[offset + 3] !== 0x02) {
      break;
    }

    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraFieldLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);

    // Extract filename
    const fileNameBytes = bytes.slice(offset + 46, offset + 46 + fileNameLength);
    const fileName = new TextDecoder('utf-8').decode(fileNameBytes);

    // Skip directories
    if (!fileName.endsWith('/')) {
      entries.push({
        name: fileName,
        compressedSize,
        uncompressedSize,
        compressionMethod,
        localHeaderOffset
      });
    }

    offset += 46 + fileNameLength + extraFieldLength + commentLength;
  }

  return entries;
}

/**
 * Extract uncompressed file content from ZIP
 * Only works for STORED (uncompressed) files
 */
function extractFileContent(bytes: Uint8Array, entry: ZipFileEntry): string {
  // Only handle STORED (uncompressed) files for simplicity
  // For compressed files, we'd need a deflate implementation
  if (entry.compressionMethod !== 0) {
    return '';
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const offset = entry.localHeaderOffset;

  // Verify Local File Header signature: 0x04034b50
  if (bytes[offset] !== 0x50 || bytes[offset + 1] !== 0x4B ||
    bytes[offset + 2] !== 0x03 || bytes[offset + 3] !== 0x04) {
    return '';
  }

  const fileNameLength = view.getUint16(offset + 26, true);
  const extraFieldLength = view.getUint16(offset + 28, true);

  const dataStart = offset + 30 + fileNameLength + extraFieldLength;
  const dataEnd = dataStart + entry.uncompressedSize;

  if (dataEnd > bytes.length) {
    return '';
  }

  const content = bytes.slice(dataStart, dataEnd);
  return new TextDecoder('utf-8').decode(content);
}

// ============================================
// Framework Detection Logic
// ============================================

/**
 * Detect framework type based on files and their contents
 */
function detectFrameworkType(
  fileNames: string[],
  requirementsContent: string,
  packageJsonContent: string
): FrameworkType {
  const requirementsLower = requirementsContent.toLowerCase();

  // Parse package.json if available
  let packageDeps: Record<string, string> = {};
  if (packageJsonContent) {
    try {
      const pkg = JSON.parse(packageJsonContent);
      packageDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    } catch {
      // Invalid JSON, ignore
    }
  }

  // Check for Next.js first (before React)
  if (packageDeps['next'] ||
    fileNames.some(f => f.includes('next.config') || f.includes('_app.tsx') || f.includes('_app.js'))) {
    return 'nextjs';
  }

  // Check for React/Vite
  if (packageDeps['react'] && (packageDeps['vite'] || fileNames.some(f => f.includes('vite.config')))) {
    return 'react';
  }

  // Check for Express
  if (packageDeps['express']) {
    return 'express';
  }

  // Check Python frameworks from requirements.txt
  if (requirementsContent) {
    if (requirementsLower.includes('streamlit')) {
      return 'streamlit';
    }
    if (requirementsLower.includes('gradio')) {
      return 'gradio';
    }
    if (requirementsLower.includes('fastapi')) {
      return 'fastapi';
    }
    if (requirementsLower.includes('flask')) {
      return 'flask';
    }
    // Has requirements.txt but no recognized framework, assume streamlit
    return 'streamlit';
  }

  // Check for Python files
  const hasPythonFiles = fileNames.some(f => f.endsWith('.py'));
  if (hasPythonFiles) {
    return 'streamlit';
  }

  // Check for Node.js project
  if (packageJsonContent) {
    return 'react'; // Default Node.js to React
  }

  // Check for static site
  const hasHtmlFiles = fileNames.some(f => f.endsWith('.html'));
  if (hasHtmlFiles) {
    return 'static';
  }

  // Default fallback
  return 'streamlit';
}

// ============================================
// Helper Functions
// ============================================

function isPythonFramework(framework: FrameworkType): boolean {
  return ['streamlit', 'gradio', 'flask', 'fastapi'].includes(framework);
}

function defaultResult(framework: FrameworkType): ZipAnalysisResult {
  return {
    framework,
    entrypoint: getDefaultEntrypoint(framework),
    has_requirements: isPythonFramework(framework),
    files: []
  };
}

/**
 * Get default entrypoint for a framework
 */
function getDefaultEntrypoint(framework: FrameworkType): string {
  switch (framework) {
    case 'streamlit':
    case 'gradio':
    case 'flask':
      return 'app.py';
    case 'fastapi':
      return 'main.py';
    case 'react':
    case 'static':
      return 'index.html';
    case 'nextjs':
      return 'pages/index.tsx';
    case 'express':
      return 'index.js';
    default:
      return 'app.py';
  }
}
