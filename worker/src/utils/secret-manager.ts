/**
 * Google Secret Manager Integration
 * Securely manage API keys and sensitive data
 */

import type { Env } from '../types';
import { ApiError } from '../types';
import { generateGCPAccessToken, parseServiceAccountKey } from './gcp-auth';

/**
 * Store a secret in Google Secret Manager
 */
export async function storeSecret(
  env: Env,
  secretId: string,
  secretValue: string
): Promise<void> {
  const accessToken = await generateGCPAccessToken(
    env.GCP_SERVICE_ACCOUNT_KEY,
    ['https://www.googleapis.com/auth/cloud-platform']
  );

  const serviceAccount = parseServiceAccountKey(env.GCP_SERVICE_ACCOUNT_KEY);
  const projectId = env.GCP_PROJECT_ID || serviceAccount.project_id;

  // Create secret if it doesn't exist
  try {
    const createResponse = await fetch(
      `https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets?secretId=${secretId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          replication: {
            automatic: {}
          }
        })
      }
    );
    // 409 = already exists, which is fine
    if (!createResponse.ok && createResponse.status !== 409) {
      console.log(`Secret create response: ${createResponse.status}`);
    }
  } catch (error) {
    // Secret might already exist, continue
  }

  // Add secret version
  const response = await fetch(
    `https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets/${secretId}:addVersion`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        payload: {
          data: btoa(secretValue)
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new ApiError(500, `Failed to store secret: ${error}`, 'SECRET_MANAGER_ERROR');
  }
}

/**
 * Get a secret from Google Secret Manager
 */
export async function getSecret(
  env: Env,
  secretId: string,
  version: string = 'latest'
): Promise<string> {
  const accessToken = await generateGCPAccessToken(
    env.GCP_SERVICE_ACCOUNT_KEY,
    ['https://www.googleapis.com/auth/cloud-platform']
  );

  const serviceAccount = parseServiceAccountKey(env.GCP_SERVICE_ACCOUNT_KEY);
  const projectId = env.GCP_PROJECT_ID || serviceAccount.project_id;

  const response = await fetch(
    `https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets/${secretId}/versions/${version}:access`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new ApiError(500, `Failed to retrieve secret: ${error}`, 'SECRET_MANAGER_ERROR');
  }

  const data = await response.json() as {
    payload?: {
      data?: string;
    };
  };

  if (!data.payload?.data) {
    throw new ApiError(500, 'Secret data not found', 'SECRET_MANAGER_ERROR');
  }

  return atob(data.payload.data);
}

/**
 * Store user's Gemini API key securely
 * Returns the secret resource name for Cloud Build
 */
export async function storeUserApiKey(
  env: Env,
  appId: string,
  apiKey: string
): Promise<string> {
  const secretId = `gemini-api-key-${appId}`;
  await storeSecret(env, secretId, apiKey);

  const serviceAccount = parseServiceAccountKey(env.GCP_SERVICE_ACCOUNT_KEY);
  const projectId = env.GCP_PROJECT_ID || serviceAccount.project_id;

  return `projects/${projectId}/secrets/${secretId}/versions/latest`;
}

/**
 * Delete user's API key after deployment
 */
export async function deleteUserApiKey(
  env: Env,
  appId: string
): Promise<void> {
  const accessToken = await generateGCPAccessToken(
    env.GCP_SERVICE_ACCOUNT_KEY,
    ['https://www.googleapis.com/auth/cloud-platform']
  );

  const serviceAccount = parseServiceAccountKey(env.GCP_SERVICE_ACCOUNT_KEY);
  const projectId = env.GCP_PROJECT_ID || serviceAccount.project_id;
  const secretId = `gemini-api-key-${appId}`;

  // Delete the secret
  await fetch(
    `https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets/${secretId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );
}
