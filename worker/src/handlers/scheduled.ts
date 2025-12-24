/**
 * Scheduled Handler
 * Cron job for cleaning up expired deployments
 */

import type { Env } from '../types';
import { getExpiredDeployments, deleteDeploymentFromD1 } from '../utils/quota';
import { deleteAppRecord } from '../utils/kv';

/**
 * Handle scheduled cleanup of expired deployments
 * Runs hourly via Cloudflare Cron Trigger
 */
export async function handleScheduledCleanup(
  _event: ScheduledEvent,
  env: Env,
  _ctx: ExecutionContext
): Promise<void> {
  console.log('Starting scheduled cleanup...');
  
  try {
    // Get all expired deployments
    const expiredDeployments = await getExpiredDeployments(env);
    
    console.log(`Found ${expiredDeployments.length} expired deployments`);
    
    for (const deployment of expiredDeployments) {
      try {
        console.log(`Cleaning up deployment: ${deployment.subdomain} (${deployment.id})`);
        
        // Delete from Cloud Run (if deployed)
        if (deployment.cloud_run_url) {
          await deleteCloudRunService(env, deployment.id);
        }
        
        // Delete associated D1 database (if any)
        if (deployment.d1_database_id) {
          // Note: D1 database deletion would require Cloudflare API
          // For now, we'll just log it
          console.log(`Would delete D1 database: ${deployment.d1_database_id}`);
        }
        
        // Delete from R2 (source files)
        try {
          await env.MITE_BUCKET.delete(`sources/${deployment.id}.zip`);
        } catch (e) {
          console.log(`R2 cleanup skipped for ${deployment.id}`);
        }
        
        // Delete from KV (legacy routing)
        await deleteAppRecord(env, deployment.id);
        
        // Delete from D1
        await deleteDeploymentFromD1(env, deployment.id);
        
        console.log(`Successfully cleaned up: ${deployment.subdomain}`);
      } catch (error) {
        console.error(`Failed to cleanup deployment ${deployment.id}:`, error);
        // Continue with other deployments
      }
    }
    
    // Clean up expired sessions
    await cleanupExpiredSessions(env);
    
    console.log('Scheduled cleanup completed');
  } catch (error) {
    console.error('Scheduled cleanup failed:', error);
    throw error;
  }
}

/**
 * Delete Cloud Run service
 */
async function deleteCloudRunService(env: Env, appId: string): Promise<void> {
  // Import dynamically to avoid circular dependencies
  const { generateGCPAccessToken } = await import('../utils/gcp-auth');
  
  try {
    const accessToken = await generateGCPAccessToken(
      env.GCP_SERVICE_ACCOUNT_KEY,
      ['https://www.googleapis.com/auth/cloud-platform']
    );
    
    const projectId = env.GCP_PROJECT_ID;
    const region = env.GCP_REGION || 'asia-east1';
    const serviceName = `mite-${appId}`;
    
    const response = await fetch(
      `https://run.googleapis.com/v2/projects/${projectId}/locations/${region}/services/${serviceName}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );
    
    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      console.error(`Failed to delete Cloud Run service ${serviceName}:`, error);
    } else {
      console.log(`Deleted Cloud Run service: ${serviceName}`);
    }
  } catch (error) {
    console.error(`Error deleting Cloud Run service for ${appId}:`, error);
  }
}

/**
 * Clean up expired sessions
 */
async function cleanupExpiredSessions(env: Env): Promise<void> {
  const now = Date.now();
  
  const result = await env.DB.prepare(
    'DELETE FROM sessions WHERE expires_at < ?'
  ).bind(now).run();
  
  console.log(`Cleaned up ${result.meta.changes} expired sessions`);
}
