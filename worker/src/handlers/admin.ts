/**
 * Admin API Handlers
 * Protected endpoints for managing deployments
 */

import type { Env, AppRecord } from '../types';
import { ApiError } from '../types';
import { deleteAppRecord } from '../utils/kv';

const APP_PREFIX = 'app:';

/**
 * Verify admin authentication
 */
function verifyAdminAuth(request: Request, env: Env): void {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Missing or invalid authorization header', 'UNAUTHORIZED');
  }
  
  const token = authHeader.slice(7);
  if (token !== env.ADMIN_TOKEN) {
    throw new ApiError(403, 'Invalid admin token', 'FORBIDDEN');
  }
}

/**
 * List all deployments
 * GET /api/v1/admin/deployments
 */
export async function handleAdminListDeployments(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== 'GET') {
    throw new ApiError(405, 'Method not allowed');
  }
  
  verifyAdminAuth(request, env);
  
  // List all keys with app: prefix
  const listResult = await env.MITE_KV.list({ prefix: APP_PREFIX });
  
  const deployments: AppRecord[] = [];
  
  for (const key of listResult.keys) {
    const data = await env.MITE_KV.get(key.name, { type: 'json' });
    if (data) {
      deployments.push(data as AppRecord);
    }
  }
  
  // Sort by created_at descending (newest first)
  deployments.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  
  // Calculate stats
  const stats = {
    total: deployments.length,
    active: deployments.filter(d => d.status === 'active').length,
    building: deployments.filter(d => d.status === 'building' || d.status === 'deploying').length,
    pending: deployments.filter(d => d.status === 'pending' || d.status === 'uploading').length,
    failed: deployments.filter(d => d.status === 'failed').length,
  };
  
  return new Response(JSON.stringify({
    deployments,
    stats,
    list_complete: listResult.list_complete
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Get deployment details
 * GET /api/v1/admin/deployments/:appId
 */
export async function handleAdminGetDeployment(
  request: Request,
  env: Env,
  appId: string
): Promise<Response> {
  if (request.method !== 'GET') {
    throw new ApiError(405, 'Method not allowed');
  }
  
  verifyAdminAuth(request, env);
  
  const data = await env.MITE_KV.get(`${APP_PREFIX}${appId}`, { type: 'json' });
  
  if (!data) {
    throw new ApiError(404, 'Deployment not found', 'NOT_FOUND');
  }
  
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Delete a deployment
 * DELETE /api/v1/admin/deployments/:appId
 */
export async function handleAdminDeleteDeployment(
  request: Request,
  env: Env,
  appId: string
): Promise<Response> {
  if (request.method !== 'DELETE') {
    throw new ApiError(405, 'Method not allowed');
  }
  
  verifyAdminAuth(request, env);
  
  // Delete from KV
  await deleteAppRecord(env, appId);
  
  // Note: Cloud Run service deletion would require additional GCP API calls
  // For now, we just clean up the KV records
  // Cloud Run services can be cleaned up separately or will be replaced on next deploy
  
  return new Response(JSON.stringify({
    success: true,
    message: `Deployment ${appId} deleted from records`
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Get admin stats
 * GET /api/v1/admin/stats
 */
export async function handleAdminStats(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== 'GET') {
    throw new ApiError(405, 'Method not allowed');
  }
  
  verifyAdminAuth(request, env);
  
  const listResult = await env.MITE_KV.list({ prefix: APP_PREFIX });
  
  let active = 0;
  let building = 0;
  let pending = 0;
  let failed = 0;
  const frameworks: Record<string, number> = {};
  
  for (const key of listResult.keys) {
    const data = await env.MITE_KV.get(key.name, { type: 'json' }) as AppRecord | null;
    if (data) {
      switch (data.status) {
        case 'active': active++; break;
        case 'building':
        case 'deploying': building++; break;
        case 'pending':
        case 'uploading': pending++; break;
        case 'failed': failed++; break;
      }
      
      if (data.framework) {
        frameworks[data.framework] = (frameworks[data.framework] || 0) + 1;
      }
    }
  }
  
  return new Response(JSON.stringify({
    total: listResult.keys.length,
    active,
    building,
    pending,
    failed,
    frameworks
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
