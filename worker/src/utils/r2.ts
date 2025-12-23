/**
 * R2 Storage Utilities
 * Handles pre-signed URL generation and file operations
 */

import type { Env } from '../types';
import { ApiError } from '../types';

/**
 * Generate a unique App ID
 */
export function generateAppId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `app_${timestamp}_${random}`;
}

/**
 * Generate a pre-signed URL for uploading to R2
 * 
 * Note: Cloudflare R2 doesn't support native pre-signed URLs in Workers yet.
 * We implement a workaround using a signed upload token that our Worker validates.
 */
export async function generateUploadUrl(
  env: Env,
  appId: string,
  filename: string,
  expiresInSeconds: number = 3600
): Promise<{ uploadUrl: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
  
  // Create a signed token for upload authorization
  const uploadToken = await createUploadToken(env, appId, filename, expiresAt);
  
  // The upload URL points to our own Worker endpoint
  const uploadUrl = `https://api.mite.now/api/v1/upload/${appId}?token=${uploadToken}`;
  
  return { uploadUrl, expiresAt };
}

/**
 * Create a signed upload token
 */
async function createUploadToken(
  env: Env,
  appId: string,
  filename: string,
  expiresAt: Date
): Promise<string> {
  const payload = {
    app_id: appId,
    filename,
    exp: expiresAt.getTime()
  };
  
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  
  // Sign with HMAC-SHA256
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env.API_SECRET_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Encode payload + signature
  const tokenPayload = btoa(JSON.stringify(payload));
  return `${tokenPayload}.${signatureHex}`;
}

/**
 * Verify an upload token
 */
export async function verifyUploadToken(
  env: Env,
  token: string
): Promise<{ appId: string; filename: string }> {
  const [payloadB64, signature] = token.split('.');
  
  if (!payloadB64 || !signature) {
    throw new ApiError(401, 'Invalid upload token format');
  }
  
  const payloadJson = atob(payloadB64);
  const payload = JSON.parse(payloadJson) as {
    app_id: string;
    filename: string;
    exp: number;
  };
  
  // Check expiration
  if (Date.now() > payload.exp) {
    throw new ApiError(401, 'Upload token expired');
  }
  
  // Verify signature
  const encoder = new TextEncoder();
  const data = encoder.encode(payloadJson);
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env.API_SECRET_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  
  const signatureBytes = new Uint8Array(
    signature.match(/.{2}/g)!.map(byte => parseInt(byte, 16))
  );
  
  const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, data);
  
  if (!isValid) {
    throw new ApiError(401, 'Invalid upload token signature');
  }
  
  return {
    appId: payload.app_id,
    filename: payload.filename
  };
}

/**
 * Upload file to R2
 */
export async function uploadToR2(
  env: Env,
  appId: string,
  file: ArrayBuffer,
  contentType: string = 'application/zip'
): Promise<void> {
  const key = `uploads/${appId}/source.zip`;
  
  await env.MITE_BUCKET.put(key, file, {
    httpMetadata: {
      contentType
    },
    customMetadata: {
      appId,
      uploadedAt: new Date().toISOString()
    }
  });
}

/**
 * Get file from R2
 */
export async function getFromR2(
  env: Env,
  appId: string
): Promise<R2ObjectBody | null> {
  const key = `uploads/${appId}/source.zip`;
  return env.MITE_BUCKET.get(key);
}

/**
 * Check if file exists in R2
 */
export async function existsInR2(
  env: Env,
  appId: string
): Promise<boolean> {
  const key = `uploads/${appId}/source.zip`;
  const head = await env.MITE_BUCKET.head(key);
  return head !== null;
}

/**
 * Delete file from R2
 */
export async function deleteFromR2(
  env: Env,
  appId: string
): Promise<void> {
  const key = `uploads/${appId}/source.zip`;
  await env.MITE_BUCKET.delete(key);
}

/**
 * Get R2 object URL for Cloud Build
 * Returns the GCS-compatible URL for R2 (if using R2's S3 API)
 */
export function getR2ObjectPath(appId: string): string {
  return `uploads/${appId}/source.zip`;
}
