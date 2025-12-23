/**
 * POST /api/v1/webhook/cloudbuild
 * Handle Cloud Build status updates via Pub/Sub push
 */

import type { Env } from '../types';
import { ApiError } from '../types';
import { updateAppStatus, activateApp, failApp, getAppRecord } from '../utils/kv';
import { getCloudRunServiceUrl } from '../utils/cloud-build';

interface CloudBuildPubSubMessage {
  message: {
    data: string; // Base64 encoded JSON
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

interface CloudBuildNotification {
  id: string;
  projectId: string;
  status: CloudBuildStatus;
  source?: {
    storageSource?: {
      bucket: string;
      object: string;
    };
  };
  steps?: Array<{
    name: string;
    status: string;
  }>;
  results?: {
    images?: Array<{
      name: string;
      digest: string;
    }>;
  };
  substitutions?: Record<string, string>;
  logUrl?: string;
  createTime?: string;
  startTime?: string;
  finishTime?: string;
}

type CloudBuildStatus = 
  | 'STATUS_UNKNOWN'
  | 'PENDING'
  | 'QUEUED'
  | 'WORKING'
  | 'SUCCESS'
  | 'FAILURE'
  | 'INTERNAL_ERROR'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'EXPIRED';

export async function handleCloudBuildWebhook(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== 'POST') {
    throw new ApiError(405, 'Method not allowed');
  }
  
  // Parse Pub/Sub message
  let pubsubMessage: CloudBuildPubSubMessage;
  try {
    pubsubMessage = await request.json() as CloudBuildPubSubMessage;
  } catch {
    throw new ApiError(400, 'Invalid JSON body');
  }
  
  if (!pubsubMessage.message?.data) {
    throw new ApiError(400, 'Missing message data');
  }
  
  // Decode base64 message
  let buildNotification: CloudBuildNotification;
  try {
    const decodedData = atob(pubsubMessage.message.data);
    buildNotification = JSON.parse(decodedData);
  } catch {
    throw new ApiError(400, 'Invalid message data format');
  }
  
  // Extract app ID from substitutions or storage object path
  const appId = extractAppId(buildNotification);
  if (!appId) {
    console.warn('Could not extract app_id from build notification:', buildNotification.id);
    return new Response(JSON.stringify({ received: true, skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Get current app record
  const appRecord = await getAppRecord(env, appId);
  if (!appRecord) {
    console.warn(`App record not found for ${appId}`);
    return new Response(JSON.stringify({ received: true, skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Process build status
  await processBuildStatus(env, appId, appRecord.subdomain, buildNotification);
  
  return new Response(JSON.stringify({ 
    received: true, 
    build_id: buildNotification.id,
    status: buildNotification.status 
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Extract app ID from build notification
 */
function extractAppId(notification: CloudBuildNotification): string | null {
  // Try substitutions first
  if (notification.substitutions?._APP_ID) {
    return notification.substitutions._APP_ID;
  }
  
  // Try to extract from storage source path
  if (notification.source?.storageSource?.object) {
    const match = notification.source.storageSource.object.match(/^(app_[^/]+)/);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Process build status and update app record
 */
async function processBuildStatus(
  env: Env,
  appId: string,
  subdomain: string,
  notification: CloudBuildNotification
): Promise<void> {
  const { status, id: buildId, logUrl } = notification;
  
  switch (status) {
    case 'PENDING':
    case 'QUEUED':
      await updateAppStatus(env, appId, 'building', { build_id: buildId });
      break;
      
    case 'WORKING':
      await updateAppStatus(env, appId, 'building', { build_id: buildId });
      break;
      
    case 'SUCCESS':
      // Build succeeded, now deploying to Cloud Run
      await updateAppStatus(env, appId, 'deploying', { build_id: buildId });
      
      // Try to get Cloud Run URL (may not be ready yet)
      try {
        const serviceUrl = await getCloudRunServiceUrl(env, subdomain);
        if (serviceUrl) {
          await activateApp(env, appId, serviceUrl);
        }
      } catch (error) {
        console.error('Failed to get Cloud Run URL:', error);
        // Will be picked up by status polling
      }
      break;
      
    case 'FAILURE':
      await failApp(env, appId, `Build failed. Check logs: ${logUrl || 'N/A'}`);
      break;
      
    case 'INTERNAL_ERROR':
      await failApp(env, appId, 'Internal build error occurred');
      break;
      
    case 'TIMEOUT':
      await failApp(env, appId, 'Build timed out (exceeded 10 minutes)');
      break;
      
    case 'CANCELLED':
      await failApp(env, appId, 'Build was cancelled');
      break;
      
    case 'EXPIRED':
      await failApp(env, appId, 'Build expired before starting');
      break;
      
    default:
      console.warn(`Unknown build status: ${status}`);
  }
}
