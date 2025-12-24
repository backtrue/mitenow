/**
 * User Deployments Handler
 * CRUD operations for user's own deployments
 */

import type { Env, Deployment } from '../types';
import { ApiError } from '../types';
import { requireAuth } from './auth';
import { deleteAppRecord } from '../utils/kv';
import { deleteDeploymentFromD1 } from '../utils/quota';

/**
 * List user's deployments
 */
export async function handleListDeployments(
  request: Request,
  env: Env
): Promise<Response> {
  const user = await requireAuth(request, env);
  
  const result = await env.DB.prepare(`
    SELECT * FROM deployments 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `).bind(user.id).all();
  
  const deployments = result.results.map(d => ({
    ...d,
    has_database: Boolean(d.has_database),
  }));
  
  return Response.json({ deployments });
}

/**
 * Get single deployment
 */
export async function handleGetDeployment(
  request: Request,
  env: Env,
  deploymentId: string
): Promise<Response> {
  const user = await requireAuth(request, env);
  
  const deployment = await env.DB.prepare(`
    SELECT * FROM deployments WHERE id = ? AND user_id = ?
  `).bind(deploymentId, user.id).first<Deployment>();
  
  if (!deployment) {
    throw new ApiError(404, 'Deployment not found');
  }
  
  return Response.json({ 
    deployment: {
      ...deployment,
      has_database: Boolean(deployment.has_database),
    }
  });
}

/**
 * Delete user's deployment
 */
export async function handleDeleteDeployment(
  request: Request,
  env: Env,
  deploymentId: string
): Promise<Response> {
  const user = await requireAuth(request, env);
  
  // Check ownership
  const deployment = await env.DB.prepare(`
    SELECT * FROM deployments WHERE id = ? AND user_id = ?
  `).bind(deploymentId, user.id).first<Deployment>();
  
  if (!deployment) {
    throw new ApiError(404, 'Deployment not found');
  }
  
  // Delete from Cloud Run
  if (deployment.cloud_run_url) {
    await deleteCloudRunService(env, deploymentId);
  }
  
  // Delete from R2
  try {
    await env.MITE_BUCKET.delete(`sources/${deploymentId}.zip`);
  } catch (e) {
    console.log(`R2 cleanup skipped for ${deploymentId}`);
  }
  
  // Delete from KV
  await deleteAppRecord(env, deploymentId);
  
  // Delete from D1
  await deleteDeploymentFromD1(env, deploymentId);
  
  return Response.json({ success: true });
}

/**
 * Delete Cloud Run service
 */
async function deleteCloudRunService(env: Env, appId: string): Promise<void> {
  const { generateGCPAccessToken } = await import('../utils/gcp-auth');
  
  try {
    const accessToken = await generateGCPAccessToken(
      env.GCP_SERVICE_ACCOUNT_KEY,
      ['https://www.googleapis.com/auth/cloud-platform']
    );
    
    const projectId = env.GCP_PROJECT_ID;
    const region = env.GCP_REGION || 'asia-east1';
    const serviceName = `mite-${appId}`;
    
    await fetch(
      `https://run.googleapis.com/v2/projects/${projectId}/locations/${region}/services/${serviceName}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );
  } catch (error) {
    console.error(`Error deleting Cloud Run service for ${appId}:`, error);
  }
}
