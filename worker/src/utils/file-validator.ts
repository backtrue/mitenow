/**
 * File Upload Security Validation
 * Deep scanning and malicious content detection
 */

import { ApiError } from '../types';

interface ZipEntry {
  filename: string;
  compressedSize: number;
  uncompressedSize: number;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_UNCOMPRESSED_SIZE = 200 * 1024 * 1024; // 200MB (防止壓縮炸彈)
const MAX_COMPRESSION_RATIO = 100; // 最大壓縮比例

// 允許的檔案副檔名白名單
const ALLOWED_EXTENSIONS = [
  // Python
  '.py', '.txt', '.md', '.json', '.yaml', '.yml', '.toml', '.cfg', '.ini',
  // JavaScript/TypeScript
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  // Web
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  // Config
  '.env.example', '.gitignore', '.dockerignore', '.editorconfig',
  // Data
  '.csv', '.xml', '.svg',
  // Docs
  '.pdf', '.doc', '.docx',
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico',
  // Package managers
  'package.json', 'package-lock.json', 'requirements.txt', 'Pipfile', 'poetry.lock',
  'yarn.lock', 'pnpm-lock.yaml'
];

// 危險檔案模式 (黑名單)
const DANGEROUS_PATTERNS = [
  // Executables
  /\.(exe|dll|so|dylib|app|dmg|pkg|deb|rpm)$/i,
  // Scripts that could be dangerous
  /\.(bat|cmd|ps1|vbs|vbe|wsf|wsh)$/i,
  // Compiled binaries
  /\.(bin|elf|o|a|lib)$/i,
  // Archives (nested archives are suspicious)
  /\.(zip|rar|7z|tar|gz|bz2|xz)$/i,
  // System files
  /\.(sys|drv|scr)$/i
];

// 路徑遍歷模式
const PATH_TRAVERSAL_PATTERNS = [
  /\.\./,           // ../
  /\.\.\\/,         // ..\
  /^\/etc\//,       // /etc/
  /^\/proc\//,      // /proc/
  /^\/sys\//,       // /sys/
  /^\/dev\//,       // /dev/
  /^\/root\//,      // /root/
  /^C:\\/i,         // C:\
  /^\\\\[^\\]+\\/   // UNC paths
];

// 惡意內容模式 (簡化版)
const MALICIOUS_CONTENT_PATTERNS = [
  // Shell commands
  /rm\s+-rf\s+\//,
  /curl\s+.*\|\s*sh/,
  /wget\s+.*\|\s*sh/,
  // Reverse shells
  /nc\s+-[el]+\s+\d+/,
  /bash\s+-i\s*>&\s*\/dev\/tcp\//,
  // Crypto mining
  /xmrig|cryptonight|stratum\+tcp/i,
  // Known malware signatures
  /eval\(base64_decode/i,
  /system\(['"]rm\s+-rf/i
];

/**
 * Validate ZIP file magic bytes
 */
export function validateZipMagicBytes(buffer: ArrayBuffer): boolean {
  const header = new Uint8Array(buffer.slice(0, 4));
  const zipMagic = [0x50, 0x4B, 0x03, 0x04]; // PK..
  return zipMagic.every((byte, i) => header[i] === byte);
}

/**
 * Parse ZIP file structure (simplified)
 * Note: This is a basic implementation. For production, consider using a proper ZIP library.
 */
function parseZipStructure(buffer: ArrayBuffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  const view = new DataView(buffer);
  let offset = 0;
  
  try {
    // Find central directory
    // This is a simplified parser - in production use a proper ZIP library
    while (offset < buffer.byteLength - 4) {
      const signature = view.getUint32(offset, true);
      
      // Local file header signature: 0x04034b50
      if (signature === 0x04034b50) {
        const compressedSize = view.getUint32(offset + 18, true);
        const uncompressedSize = view.getUint32(offset + 22, true);
        const filenameLength = view.getUint16(offset + 26, true);
        const extraFieldLength = view.getUint16(offset + 28, true);
        
        // Get filename
        const filenameBytes = new Uint8Array(buffer.slice(offset + 30, offset + 30 + filenameLength));
        const filename = new TextDecoder().decode(filenameBytes);
        
        entries.push({
          filename,
          compressedSize,
          uncompressedSize
        });
        
        // Move to next entry
        offset += 30 + filenameLength + extraFieldLength + compressedSize;
      } else {
        offset++;
      }
    }
  } catch (error) {
    throw new ApiError(400, 'Invalid ZIP file structure');
  }
  
  return entries;
}

/**
 * Validate file size
 */
export function validateFileSize(buffer: ArrayBuffer): void {
  if (buffer.byteLength > MAX_FILE_SIZE) {
    throw new ApiError(413, `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }
  
  if (buffer.byteLength === 0) {
    throw new ApiError(400, 'File is empty');
  }
}

/**
 * Check for compression bomb (zip bomb)
 */
function checkCompressionBomb(entries: ZipEntry[]): void {
  let totalCompressed = 0;
  let totalUncompressed = 0;
  
  for (const entry of entries) {
    totalCompressed += entry.compressedSize;
    totalUncompressed += entry.uncompressedSize;
    
    // Check individual file compression ratio
    if (entry.compressedSize > 0) {
      const ratio = entry.uncompressedSize / entry.compressedSize;
      if (ratio > MAX_COMPRESSION_RATIO) {
        throw new ApiError(400, `Suspicious compression ratio detected in file: ${entry.filename}`);
      }
    }
  }
  
  // Check total uncompressed size
  if (totalUncompressed > MAX_UNCOMPRESSED_SIZE) {
    throw new ApiError(400, `Uncompressed size too large: ${totalUncompressed} bytes (max: ${MAX_UNCOMPRESSED_SIZE})`);
  }
  
  // Check overall compression ratio
  if (totalCompressed > 0) {
    const overallRatio = totalUncompressed / totalCompressed;
    if (overallRatio > MAX_COMPRESSION_RATIO) {
      throw new ApiError(400, 'Suspicious compression ratio detected (possible zip bomb)');
    }
  }
}

/**
 * Validate filename for path traversal and dangerous patterns
 */
function validateFilename(filename: string): void {
  // Check for path traversal
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(filename)) {
      throw new ApiError(400, `Dangerous path detected: ${filename}`);
    }
  }
  
  // Check for dangerous file types
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(filename)) {
      throw new ApiError(400, `Dangerous file type not allowed: ${filename}`);
    }
  }
  
  // Check if file extension is in whitelist (for known extensions)
  const hasKnownExtension = ALLOWED_EXTENSIONS.some(ext => 
    filename.toLowerCase().endsWith(ext) || filename === ext
  );
  
  // Allow files without extensions (like Dockerfile, Makefile)
  const hasNoExtension = !filename.includes('.') || filename.startsWith('.');
  
  if (!hasKnownExtension && !hasNoExtension) {
    // Be lenient but log suspicious files
    console.warn(`Unknown file extension: ${filename}`);
  }
  
  // Check filename length
  if (filename.length > 255) {
    throw new ApiError(400, 'Filename too long');
  }
  
  // Check for null bytes
  if (filename.includes('\0')) {
    throw new ApiError(400, 'Invalid filename (null byte detected)');
  }
}

/**
 * Scan file content for malicious patterns
 */
async function scanFileContent(buffer: ArrayBuffer): Promise<void> {
  // Convert buffer to string for text-based scanning
  // Only scan first 1MB to avoid performance issues
  const scanSize = Math.min(buffer.byteLength, 1024 * 1024);
  const textContent = new TextDecoder('utf-8').decode(
    new Uint8Array(buffer.slice(0, scanSize))
  );
  
  // Check for malicious patterns
  for (const pattern of MALICIOUS_CONTENT_PATTERNS) {
    if (pattern.test(textContent)) {
      throw new ApiError(400, 'Potentially malicious content detected');
    }
  }
  
  // Check for excessive obfuscation (too many base64-like strings)
  const base64Pattern = /[A-Za-z0-9+\/]{100,}/g;
  const base64Matches = textContent.match(base64Pattern);
  if (base64Matches && base64Matches.length > 10) {
    console.warn('High amount of base64-encoded content detected');
  }
}

/**
 * Comprehensive ZIP file security validation
 */
export async function validateZipFile(buffer: ArrayBuffer): Promise<void> {
  // 1. Validate file size
  validateFileSize(buffer);
  
  // 2. Validate ZIP magic bytes
  if (!validateZipMagicBytes(buffer)) {
    throw new ApiError(400, 'Invalid ZIP file format');
  }
  
  // 3. Parse ZIP structure
  const entries = parseZipStructure(buffer);
  
  if (entries.length === 0) {
    throw new ApiError(400, 'ZIP file is empty');
  }
  
  if (entries.length > 1000) {
    throw new ApiError(400, 'Too many files in ZIP (max: 1000)');
  }
  
  // 4. Check for compression bomb
  checkCompressionBomb(entries);
  
  // 5. Validate each filename
  for (const entry of entries) {
    validateFilename(entry.filename);
  }
  
  // 6. Scan content for malicious patterns
  await scanFileContent(buffer);
  
  console.log(`ZIP validation passed: ${entries.length} files, ${buffer.byteLength} bytes`);
}

/**
 * Quick validation for upload endpoint (before full processing)
 */
export async function quickValidateUpload(buffer: ArrayBuffer): Promise<void> {
  validateFileSize(buffer);
  
  if (!validateZipMagicBytes(buffer)) {
    throw new ApiError(400, 'Invalid ZIP file format');
  }
  
  // Basic content scan
  await scanFileContent(buffer);
}
