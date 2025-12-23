/**
 * GET /api/v1/status/:id
 * Query deployment status from KV
 */

import type { Env, StatusResponse } from '../types';
import { ApiError } from '../types';
import { getAppRecord, updateAppStatus, activateApp } from '../utils/kv';
import { getBuildStatus, getCloudRunServiceUrl } from '../utils/cloud-build';

export async function handleStatus(
  request: Request,
  env: Env,
  appId: string
): Promise<Response> {
  if (request.method !== 'GET') {
    throw new ApiError(405, 'Method not allowed');
  }
  
  if (!appId || typeof appId !== 'string') {
    throw new ApiError(400, 'Missing or invalid app ID');
  }
  
  // Get app record from KV
  const record = await getAppRecord(env, appId);
  
  if (!record) {
    throw new ApiError(404, 'App not found');
  }
  
  // If building, check Cloud Build status
  if (record.status === 'building' && record.build_id) {
    try {
      const buildStatus = await getBuildStatus(env, record.build_id);
      
      // Map Cloud Build status to our status
      switch (buildStatus.status) {
        case 'SUCCESS':
          // Build succeeded, now check Cloud Run
          await updateAppStatus(env, appId, 'deploying');
          record.status = 'deploying';
          break;
          
        case 'FAILURE':
        case 'INTERNAL_ERROR':
        case 'TIMEOUT':
        case 'CANCELLED':
          await updateAppStatus(env, appId, 'failed', {
            error: `Build ${buildStatus.status.toLowerCase()}`
          });
          record.status = 'failed';
          record.error = `Build ${buildStatus.status.toLowerCase()}`;
          break;
          
        case 'WORKING':
        case 'QUEUED':
          // Still building
          break;
      }
    } catch (error) {
      // Log but don't fail - return cached status
      console.error('Failed to check build status:', error);
    }
  }
  
  // If deploying, check Cloud Run service
  if (record.status === 'deploying') {
    try {
      const serviceUrl = await getCloudRunServiceUrl(env, record.subdomain);
      
      if (serviceUrl) {
        // Service is ready
        await activateApp(env, appId, serviceUrl);
        record.status = 'active';
        record.target_url = serviceUrl;
      }
    } catch (error) {
      console.error('Failed to check Cloud Run status:', error);
    }
  }
  
  const response: StatusResponse = {
    app_id: record.app_id,
    subdomain: record.subdomain,
    status: record.status,
    target_url: record.status === 'active' ? `https://${record.subdomain}.mite.now` : undefined,
    error: record.error,
    created_at: record.created_at,
    updated_at: record.updated_at,
    build_id: record.build_id
  };
  
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
