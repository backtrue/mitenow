/**
 * GCP Authentication Utilities
 * Handles Service Account JWT generation for Google Cloud APIs
 */

import type { ServiceAccountKey } from '../types';

// Token cache to avoid repeated token generation
// Key includes scopes to avoid scope mismatch
const tokenCache = new Map<string, { token: string; expiry: number }>();

/**
 * Generate a JWT token for GCP API authentication
 */
export async function generateGCPAccessToken(
  serviceAccountKeyBase64: string,
  scopes: string[]
): Promise<string> {
  // Check cache first (keyed by scopes)
  const cacheKey = scopes.sort().join(',');
  const now = Math.floor(Date.now() / 1000);
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiry > now + 60) {
    return cached.token;
  }
  
  const keyJson = atob(serviceAccountKeyBase64);
  const serviceAccount: ServiceAccountKey = JSON.parse(keyJson);
  
  const expiry = now + 3600; // 1 hour
  
  // Create JWT header and claims
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: expiry,
    scope: scopes.join(' ')
  };
  
  // Create JWT
  const jwt = await createSignedJWT(header, claims, serviceAccount.private_key);
  
  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  
  const responseText = await tokenResponse.text();
  
  if (!tokenResponse.ok) {
    console.error('Token exchange failed:', responseText);
    console.error('JWT used:', jwt.substring(0, 50) + '...');
    throw new Error(`Failed to get access token: ${responseText}`);
  }
  
  const tokenData = JSON.parse(responseText) as { access_token: string; expires_in?: number };
  
  // Cache the token with scope key
  tokenCache.set(cacheKey, {
    token: tokenData.access_token,
    expiry: now + (tokenData.expires_in || 3600) - 60
  });
  
  return tokenData.access_token;
}

/**
 * Create and sign a JWT
 */
async function createSignedJWT(
  header: object,
  claims: object,
  privateKeyPem: string
): Promise<string> {
  // Encode header and claims as base64url
  const headerB64 = toBase64Url(JSON.stringify(header));
  const claimsB64 = toBase64Url(JSON.stringify(claims));
  const unsignedToken = `${headerB64}.${claimsB64}`;
  
  // Import the private key
  const privateKey = await importPKCS8Key(privateKeyPem);
  
  // Sign the token
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    encoder.encode(unsignedToken)
  );
  
  // Encode signature as base64url
  const signatureB64 = arrayBufferToBase64Url(signature);
  
  return `${unsignedToken}.${signatureB64}`;
}

/**
 * Import a PKCS8 PEM private key
 */
async function importPKCS8Key(pem: string): Promise<CryptoKey> {
  // Extract the base64 content from PEM
  const pemLines = pem.split('\n');
  const base64Content = pemLines
    .filter(line => !line.startsWith('-----'))
    .join('');
  
  // Decode base64 to binary
  const binaryString = atob(base64Content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: { name: 'SHA-256' }
    },
    false,
    ['sign']
  );
}

/**
 * Convert string to base64url
 */
function toBase64Url(str: string): string {
  const base64 = btoa(str);
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Convert ArrayBuffer to base64url
 */
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Get parsed service account info
 */
export function parseServiceAccountKey(base64Key: string): ServiceAccountKey {
  const keyJson = atob(base64Key);
  return JSON.parse(keyJson);
}
