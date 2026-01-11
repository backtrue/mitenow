/**
 * POST /api/v1/prepare
 * Generate R2 pre-signed URL for file upload
 */

import type { Env, PrepareRequest, PrepareResponse } from '../types';
import { ApiError } from '../types';
import { generateAppId, generateUploadUrl } from '../utils/r2';
import { validateZipFile } from '../utils/file-validator';
import { runSecurityChecks } from '../utils/security-scanner';

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

  // Comprehensive security validation (malware, zip bombs, etc.)
  try {
    await validateZipFile(fileBuffer);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(400, 'File validation failed');
  }

  // Run 5 security checks (API keys, sensitive files, etc.)
  const securityResult = await runSecurityChecks(fileBuffer);

  // Store security results in KV for frontend to fetch
  await env.MITE_KV.put(
    `security:${appId}`,
    JSON.stringify(securityResult),
    { expirationTtl: 3600 } // 1 hour
  );

  // Upload to R2
  await uploadToR2(env, appId, fileBuffer, contentType);

  return new Response(JSON.stringify({
    success: true,
    app_id: appId,
    message: 'File uploaded successfully',
    security: securityResult
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

/**
 * GET /api/v1/security/:appId
 * Get security scan results for an app
 */
export async function handleGetSecurity(
  request: Request,
  env: Env,
  appId: string
): Promise<Response> {
  if (request.method !== 'GET') {
    throw new ApiError(405, 'Method not allowed');
  }

  const result = await env.MITE_KV.get(`security:${appId}`);

  if (!result) {
    throw new ApiError(404, 'Security scan results not found');
  }

  return new Response(result, {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

