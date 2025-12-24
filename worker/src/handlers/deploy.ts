/**
 * POST /api/v1/deploy
 * Trigger GCP Cloud Build deployment
 */

import type { Env, DeployRequest, DeployResponse } from '../types';
import { ApiError } from '../types';
import { existsInR2 } from '../utils/r2';
import { 
  createAppRecord, 
  updateAppStatus, 
  isSubdomainAvailable 
} from '../utils/kv';
import { triggerCloudBuild } from '../utils/cloud-build';
import { storeUserApiKey, deleteUserApiKey } from '../utils/secret-manager';
import { transferR2ToGcs } from '../utils/gcs';
import { analyzeAppFramework } from '../utils/framework-detector';

// Subdomain validation regex
const SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export async function handleDeploy(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== 'POST') {
    throw new ApiError(405, 'Method not allowed');
  }
  
  // Parse request body
  let body: DeployRequest;
  try {
    body = await request.json() as DeployRequest;
  } catch {
    throw new ApiError(400, 'Invalid JSON body');
  }
  
  // Validate required fields
  if (!body.app_id || typeof body.app_id !== 'string') {
    throw new ApiError(400, 'Missing or invalid app_id');
  }
  
  if (!body.api_key || typeof body.api_key !== 'string') {
    throw new ApiError(400, 'Missing or invalid api_key');
  }
  
  if (!body.subdomain || typeof body.subdomain !== 'string') {
    throw new ApiError(400, 'Missing or invalid subdomain');
  }
  
  // Validate subdomain format
  const subdomain = body.subdomain.toLowerCase().trim();
  if (!SUBDOMAIN_REGEX.test(subdomain)) {
    throw new ApiError(400, 'Invalid subdomain format. Use lowercase letters, numbers, and hyphens only.');
  }
  
  if (subdomain.length < 3 || subdomain.length > 63) {
    throw new ApiError(400, 'Subdomain must be between 3 and 63 characters');
  }
  
  // Check subdomain availability
  const available = await isSubdomainAvailable(env, subdomain);
  if (!available) {
    throw new ApiError(409, 'Subdomain is already taken or reserved');
  }
  
  // Verify ZIP file exists in R2
  const zipExists = await existsInR2(env, body.app_id);
  if (!zipExists) {
    throw new ApiError(404, 'ZIP file not found. Please upload first using /api/v1/prepare');
  }
  
  // Validate API key format (basic check for Gemini API key)
  if (!isValidApiKeyFormat(body.api_key)) {
    throw new ApiError(400, 'Invalid API key format');
  }
  
  // Create app record in KV
  await createAppRecord(env, body.app_id, subdomain);
  
  // Update status to uploading (transferring to GCS)
  await updateAppStatus(env, body.app_id, 'uploading');
  
  try {
    // Transfer ZIP from R2 to GCS for Cloud Build
    console.log(`Transferring ${body.app_id} from R2 to GCS...`);
    await transferR2ToGcs(env, body.app_id);
    console.log(`Transfer complete for ${body.app_id}`);
    
    // Analyze ZIP contents to detect framework
    const analysis = await analyzeAppFramework(env, body.app_id, body.framework);
    
    // Update status to building
    await updateAppStatus(env, body.app_id, 'building', {
      framework: analysis.framework
    });
    
    // Store API key securely in Secret Manager
    console.log(`Storing API key in Secret Manager for ${body.app_id}`);
    const secretResourceName = await storeUserApiKey(env, body.app_id, body.api_key);
    
    // Trigger Cloud Build with Secret Manager reference
    // API key is now stored securely and referenced by Cloud Run
    const buildResponse = await triggerCloudBuild(
      env,
      body.app_id,
      subdomain,
      analysis,
      secretResourceName
    );
    
    // Extract build ID from response
    const buildId = buildResponse.metadata?.build?.id;
    
    // Update record with build ID
    await updateAppStatus(env, body.app_id, 'building', {
      build_id: buildId
    });
    
    const response: DeployResponse = {
      app_id: body.app_id,
      subdomain,
      status: 'building',
      message: `Deployment started. Your app will be available at https://${subdomain}.mite.now`
    };
    
    return new Response(JSON.stringify(response), {
      status: 202, // Accepted
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    // Clean up: delete the stored API key on failure
    try {
      await deleteUserApiKey(env, body.app_id);
    } catch (cleanupError) {
      console.error('Failed to cleanup API key:', cleanupError);
    }
    
    // Update status to failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateAppStatus(env, body.app_id, 'failed', {
      error: errorMessage
    });
    
    throw new ApiError(500, `Deployment failed: ${errorMessage}`, 'DEPLOY_ERROR');
  }
}

/**
 * Basic validation for API key format
 * Gemini API keys typically start with 'AI' and are 39 characters
 */
function isValidApiKeyFormat(apiKey: string): boolean {
  // Basic length and character check
  if (apiKey.length < 20 || apiKey.length > 100) {
    return false;
  }
  
  // Should only contain alphanumeric and some special chars
  if (!/^[A-Za-z0-9_-]+$/.test(apiKey)) {
    return false;
  }
  
  return true;
}
