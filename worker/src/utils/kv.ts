/**
 * KV Storage Utilities
 * Handles deployment state and routing table management
 */

import type { Env, AppRecord, DeploymentStatus } from '../types';

const APP_PREFIX = 'app:';
const SUBDOMAIN_PREFIX = 'subdomain:';

/**
 * Create a new app record in KV
 */
export async function createAppRecord(
  env: Env,
  appId: string,
  subdomain: string
): Promise<AppRecord> {
  const now = new Date().toISOString();
  
  const record: AppRecord = {
    app_id: appId,
    subdomain,
    status: 'pending',
    created_at: now,
    updated_at: now
  };
  
  // Store app record
  await env.MITE_KV.put(
    `${APP_PREFIX}${appId}`,
    JSON.stringify(record),
    { expirationTtl: 86400 * 30 } // 30 days TTL
  );
  
  // Store subdomain -> appId mapping
  await env.MITE_KV.put(
    `${SUBDOMAIN_PREFIX}${subdomain}`,
    appId,
    { expirationTtl: 86400 * 30 }
  );
  
  return record;
}

/**
 * Get app record by ID
 */
export async function getAppRecord(
  env: Env,
  appId: string
): Promise<AppRecord | null> {
  const data = await env.MITE_KV.get(`${APP_PREFIX}${appId}`, { type: 'json' });
  return data as AppRecord | null;
}

/**
 * Get app record by subdomain
 */
export async function getAppBySubdomain(
  env: Env,
  subdomain: string
): Promise<AppRecord | null> {
  const appId = await env.MITE_KV.get(`${SUBDOMAIN_PREFIX}${subdomain}`);
  if (!appId) return null;
  
  return getAppRecord(env, appId);
}

/**
 * Update app record status
 */
export async function updateAppStatus(
  env: Env,
  appId: string,
  status: DeploymentStatus,
  additionalFields?: Partial<AppRecord>
): Promise<AppRecord | null> {
  const record = await getAppRecord(env, appId);
  if (!record) return null;
  
  const updated: AppRecord = {
    ...record,
    ...additionalFields,
    status,
    updated_at: new Date().toISOString()
  };
  
  await env.MITE_KV.put(
    `${APP_PREFIX}${appId}`,
    JSON.stringify(updated),
    { expirationTtl: 86400 * 30 }
  );
  
  return updated;
}

/**
 * Set app as active with target URL
 */
export async function activateApp(
  env: Env,
  appId: string,
  targetUrl: string
): Promise<AppRecord | null> {
  return updateAppStatus(env, appId, 'active', { target_url: targetUrl });
}

/**
 * Set app as failed with error message
 */
export async function failApp(
  env: Env,
  appId: string,
  error: string
): Promise<AppRecord | null> {
  return updateAppStatus(env, appId, 'failed', { error });
}

/**
 * Check if subdomain is available
 * Returns detailed status for better UX
 */
export interface SubdomainCheckResult {
  available: boolean;
  reason?: 'reserved' | 'in_use' | 'stale_failed';
  canRelease?: boolean; // True if it's a failed deployment that can be released
}

export async function isSubdomainAvailable(
  env: Env,
  subdomain: string
): Promise<boolean> {
  const result = await checkSubdomainAvailability(env, subdomain);
  return result.available;
}

export async function checkSubdomainAvailability(
  env: Env,
  subdomain: string
): Promise<SubdomainCheckResult> {
  // Reserved subdomains
  const reserved = ['www', 'api', 'app', 'admin', 'mite', 'static', 'assets', 'mail', 'ftp', 'cdn'];
  if (reserved.includes(subdomain.toLowerCase())) {
    return { available: false, reason: 'reserved' };
  }
  
  const appId = await env.MITE_KV.get(`${SUBDOMAIN_PREFIX}${subdomain}`);
  if (!appId) {
    return { available: true };
  }
  
  // Check if the existing record is a stale failed deployment
  const record = await getAppRecord(env, appId);
  if (!record) {
    // Orphaned subdomain mapping - clean it up and allow reuse
    await env.MITE_KV.delete(`${SUBDOMAIN_PREFIX}${subdomain}`);
    return { available: true };
  }
  
  // Check if it's a failed or expired deployment that can be released
  const isStale = record.status === 'failed' || record.status === 'expired';
  const isOldPending = record.status === 'pending' && 
    (Date.now() - new Date(record.created_at).getTime() > 30 * 60 * 1000); // 30 min old pending
  const isOldBuilding = (record.status === 'building' || record.status === 'uploading') &&
    (Date.now() - new Date(record.updated_at).getTime() > 60 * 60 * 1000); // 1 hour old building
  
  if (isStale || isOldPending || isOldBuilding) {
    return { available: false, reason: 'stale_failed', canRelease: true };
  }
  
  return { available: false, reason: 'in_use' };
}

/**
 * Delete app record and subdomain mapping
 */
export async function deleteAppRecord(
  env: Env,
  appId: string
): Promise<void> {
  const record = await getAppRecord(env, appId);
  if (!record) return;
  
  await Promise.all([
    env.MITE_KV.delete(`${APP_PREFIX}${appId}`),
    env.MITE_KV.delete(`${SUBDOMAIN_PREFIX}${record.subdomain}`)
  ]);
}

/**
 * Release a stale subdomain (failed/expired deployments)
 */
export async function releaseStaleSubdomain(
  env: Env,
  subdomain: string
): Promise<boolean> {
  const check = await checkSubdomainAvailability(env, subdomain);
  
  if (!check.canRelease) {
    return false;
  }
  
  const appId = await env.MITE_KV.get(`${SUBDOMAIN_PREFIX}${subdomain}`);
  if (appId) {
    await deleteAppRecord(env, appId);
  }
  
  return true;
}

/**
 * Get routing info for reverse proxy
 */
export interface RoutingInfo {
  targetUrl: string;
  appId: string;
  status: DeploymentStatus;
}

export async function getRoutingInfo(
  env: Env,
  subdomain: string
): Promise<RoutingInfo | null> {
  const record = await getAppBySubdomain(env, subdomain);
  
  if (!record || record.status !== 'active' || !record.target_url) {
    return null;
  }
  
  return {
    targetUrl: record.target_url,
    appId: record.app_id,
    status: record.status
  };
}
