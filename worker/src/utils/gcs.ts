/**
 * Google Cloud Storage utilities
 * Upload files from R2 to GCS for Cloud Build
 */

import type { Env } from '../types';
import { generateGCPAccessToken } from './gcp-auth';

const GCS_BUCKET = 'mite-uploads-omakase-481015';

/**
 * Upload a file to GCS
 */
export async function uploadToGcs(
  env: Env,
  objectName: string,
  data: ArrayBuffer,
  contentType: string = 'application/zip'
): Promise<string> {
  const accessToken = await generateGCPAccessToken(
    env.GCP_SERVICE_ACCOUNT_KEY,
    ['https://www.googleapis.com/auth/devstorage.read_write']
  );
  
  const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${GCS_BUCKET}/o?uploadType=media&name=${encodeURIComponent(objectName)}`;
  
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': contentType,
    },
    body: data,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload to GCS: ${response.status} - ${error}`);
  }
  
  const result = await response.json() as { name: string; bucket: string };
  return `gs://${result.bucket}/${result.name}`;
}

/**
 * Transfer file from R2 to GCS
 */
export async function transferR2ToGcs(
  env: Env,
  appId: string
): Promise<string> {
  // Get file from R2 (path matches uploadToR2 in r2.ts)
  const r2Key = `uploads/${appId}/source.zip`;
  const r2Object = await env.MITE_BUCKET.get(r2Key);
  
  if (!r2Object) {
    throw new Error(`File not found in R2: ${r2Key}`);
  }
  
  // Read the file content
  const data = await r2Object.arrayBuffer();
  
  // Upload to GCS with same path
  const gcsPath = `${appId}/source.zip`;
  const gcsUri = await uploadToGcs(env, gcsPath, data, 'application/zip');
  
  console.log(`Transferred ${r2Key} to ${gcsUri}`);
  
  return gcsUri;
}

/**
 * Check if file exists in GCS
 */
export async function gcsFileExists(
  env: Env,
  objectName: string
): Promise<boolean> {
  const accessToken = await generateGCPAccessToken(
    env.GCP_SERVICE_ACCOUNT_KEY,
    ['https://www.googleapis.com/auth/devstorage.read_write']
  );
  
  const url = `https://storage.googleapis.com/storage/v1/b/${GCS_BUCKET}/o/${encodeURIComponent(objectName)}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  return response.ok;
}

/**
 * Delete file from GCS
 */
export async function deleteFromGcs(
  env: Env,
  objectName: string
): Promise<void> {
  const accessToken = await generateGCPAccessToken(
    env.GCP_SERVICE_ACCOUNT_KEY,
    ['https://www.googleapis.com/auth/devstorage.read_write']
  );
  
  const url = `https://storage.googleapis.com/storage/v1/b/${GCS_BUCKET}/o/${encodeURIComponent(objectName)}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok && response.status !== 404) {
    const error = await response.text();
    throw new Error(`Failed to delete from GCS: ${response.status} - ${error}`);
  }
}
