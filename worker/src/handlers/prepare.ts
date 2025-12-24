/**
 * POST /api/v1/prepare
 * Generate R2 pre-signed URL for file upload
 */

import type { Env, PrepareRequest, PrepareResponse } from '../types';
import { ApiError } from '../types';
import { generateAppId, generateUploadUrl } from '../utils/r2';
import { validateZipFile } from '../utils/file-validator';

export async function handlePrepare(
  request: Request,
  env: Env
): Promise<Response> {
  // Validate request method
  if (request.method !== 'POST') {
    throw new ApiError(405, 'Method not allowed');
  }
  
  // Parse request body
  let body: PrepareRequest;
  try {
    body = await request.json() as PrepareRequest;
  } catch {
    throw new ApiError(400, 'Invalid JSON body');
  }
  
  // Validate filename
  if (!body.filename || typeof body.filename !== 'string') {
    throw new ApiError(400, 'Missing or invalid filename');
  }
  
  // Validate file extension
  if (!body.filename.toLowerCase().endsWith('.zip')) {
    throw new ApiError(400, 'Only ZIP files are supported');
  }
  
  // Generate unique app ID
  const appId = generateAppId();
  
  // Generate pre-signed upload URL
  const { uploadUrl, expiresAt } = await generateUploadUrl(
    env,
    appId,
    body.filename,
    3600 // 1 hour expiry
  );
  
  const response: PrepareResponse = {
    app_id: appId,
    upload_url: uploadUrl,
    expires_at: expiresAt.toISOString()
  };
  
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

/**
 * POST /api/v1/upload/:appId
 * Handle actual file upload to R2
 */
export async function handleUpload(
  request: Request,
  env: Env,
  appId: string,
  token: string
): Promise<Response> {
  if (request.method !== 'POST' && request.method !== 'PUT') {
    throw new ApiError(405, 'Method not allowed');
  }
  
  // Verify upload token
  const { verifyUploadToken, uploadToR2 } = await import('../utils/r2');
  
  try {
    const verified = await verifyUploadToken(env, token);
    if (verified.appId !== appId) {
      throw new ApiError(401, 'Token does not match app ID');
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'Invalid upload token');
  }
  
  // Get file content
  const contentType = request.headers.get('Content-Type') || 'application/zip';
  const fileBuffer = await request.arrayBuffer();
  
  // Comprehensive security validation
  try {
    await validateZipFile(fileBuffer);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(400, 'File validation failed');
  }
  
  // Upload to R2
  await uploadToR2(env, appId, fileBuffer, contentType);
  
  return new Response(JSON.stringify({
    success: true,
    app_id: appId,
    message: 'File uploaded successfully'
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
