/**
 * Framework Detection Utility
 * Analyzes uploaded ZIP contents to detect the framework type
 */

import type { Env, FrameworkType, ZipAnalysisResult } from '../types';

/**
 * Analyze app framework from R2 stored files
 * Uses file signatures to detect the framework type
 */
// Valid framework types that can be used as overrides
const VALID_FRAMEWORKS: FrameworkType[] = ['streamlit', 'gradio', 'flask', 'fastapi', 'react', 'nextjs', 'express', 'static'];

export async function analyzeAppFramework(
  env: Env,
  appId: string,
  overrideFramework?: string
): Promise<ZipAnalysisResult> {
  // If framework is explicitly specified and valid, use it
  // Note: 'auto' or 'unknown' will trigger auto-detection
  if (overrideFramework && VALID_FRAMEWORKS.includes(overrideFramework as FrameworkType)) {
    const framework = overrideFramework as FrameworkType;
    return {
      framework,
      entrypoint: getDefaultEntrypoint(framework),
      has_requirements: framework === 'streamlit' || framework === 'gradio' || framework === 'flask' || framework === 'fastapi',
      files: []
    };
  }
  
  console.log(`Auto-detecting framework for ${appId}...`);

  // Get the source.zip path
  const prefix = `uploads/${appId}/`;
  
  // Get the source.zip and analyze its metadata or check for marker files
  const sourceKey = `${prefix}source.zip`;
  const sourceObject = await env.MITE_BUCKET.head(sourceKey);
  
  if (!sourceObject) {
    // Default to streamlit if no source found
    return {
      framework: 'streamlit',
      entrypoint: 'app.py',
      has_requirements: true,
      files: []
    };
  }

  // Check custom metadata for framework hint
  const metadataFramework = sourceObject.customMetadata?.framework as FrameworkType | undefined;
  if (metadataFramework) {
    return {
      framework: metadataFramework,
      entrypoint: getDefaultEntrypoint(metadataFramework),
      has_requirements: true,
      files: []
    };
  }

  // Try to detect framework by reading the ZIP file
  // For now, we'll use a simple heuristic based on file signatures
  const sourceData = await env.MITE_BUCKET.get(sourceKey);
  if (!sourceData) {
    return {
      framework: 'streamlit',
      entrypoint: 'app.py',
      has_requirements: true,
      files: []
    };
  }

  const zipBuffer = await sourceData.arrayBuffer();
  const { framework, hasRequirements, hasPackageJson } = detectFrameworkFromZip(zipBuffer);
  
  console.log(`Detected framework: ${framework}, hasRequirements: ${hasRequirements}, hasPackageJson: ${hasPackageJson}`);

  return {
    framework,
    entrypoint: getDefaultEntrypoint(framework),
    has_requirements: hasRequirements,
    has_package_json: hasPackageJson,
    files: []
  };
}

interface ZipDetectionResult {
  framework: FrameworkType;
  hasRequirements: boolean;
  hasPackageJson: boolean;
}

/**
 * Detect framework by analyzing ZIP file contents
 * Uses simple heuristics based on file names in the ZIP central directory
 */
function detectFrameworkFromZip(zipBuffer: ArrayBuffer): ZipDetectionResult {
  const bytes = new Uint8Array(zipBuffer);
  const text = new TextDecoder('utf-8').decode(bytes);
  
  // Check for actual file presence
  const hasRequirements = text.includes('requirements.txt');
  const hasPackageJson = text.includes('package.json');
  
  // Look for common file patterns in the ZIP
  // ZIP files contain file names in their central directory
  
  let framework: FrameworkType;
  
  // Check for Next.js first (before React, since Next.js also uses React)
  if (text.includes('next.config') || text.includes('_app.tsx') || text.includes('_app.js') || text.includes('"next"')) {
    framework = 'nextjs';
  }
  // React/Vite indicators
  else if (text.includes('vite.config') || 
      (hasPackageJson && (text.includes('"react"') || text.includes('"vite"')))) {
    framework = 'react';
  }
  // Express.js indicators
  else if (hasPackageJson && (text.includes('"express"') || text.includes('express()'))) {
    framework = 'express';
  }
  // Python framework indicators
  else if (hasRequirements || text.includes('.py')) {
    // Check for specific frameworks
    if (text.includes('streamlit')) {
      framework = 'streamlit';
    } else if (text.includes('gradio')) {
      framework = 'gradio';
    } else if (text.includes('fastapi') || text.includes('FastAPI')) {
      framework = 'fastapi';
    } else if (text.includes('flask') || text.includes('Flask')) {
      framework = 'flask';
    } else {
      // Default Python app to streamlit
      framework = 'streamlit';
    }
  }
  // Check for package.json (Node.js project)
  else if (hasPackageJson) {
    framework = 'react'; // Default Node.js to React
  }
  // Check for pure static site (index.html without package.json or requirements.txt)
  else if (text.includes('index.html') && !hasPackageJson && !hasRequirements) {
    framework = 'static';
  }
  // Default to static if we have HTML files
  else if (text.includes('.html')) {
    framework = 'static';
  }
  // Default to streamlit
  else {
    framework = 'streamlit';
  }
  
  return { framework, hasRequirements, hasPackageJson };
}

/**
 * Get default entrypoint for a framework
 */
function getDefaultEntrypoint(framework: FrameworkType): string {
  switch (framework) {
    case 'streamlit':
      return 'app.py';
    case 'gradio':
      return 'app.py';
    case 'flask':
      return 'app.py';
    case 'fastapi':
      return 'main.py';
    case 'react':
      return 'index.html';
    case 'nextjs':
      return 'pages/index.tsx';
    case 'express':
      return 'index.js';
    case 'static':
      return 'index.html';
    default:
      return 'app.py';
  }
}
