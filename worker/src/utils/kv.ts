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

export interface ReleaseResult {
  success: boolean;
  reason?: string;
}

/**
 * Release a stale subdomain (failed/expired deployments)
 * Users can always release their own deployments
 * Non-owners must wait for cooldown period
 */
export async function releaseStaleSubdomain(
  env: Env,
  subdomain: string,
  userId?: string
): Promise<ReleaseResult> {
  const check = await checkSubdomainAvailability(env, subdomain);

  if (!check.canRelease) {
    return { success: false, reason: '此子網域目前無法釋放（正在使用中或是保留網域）' };
  }

  const appId = await env.MITE_KV.get(`${SUBDOMAIN_PREFIX}${subdomain}`);
  if (!appId) {
    return { success: false, reason: '找不到此子網域的記錄' };
  }

  // Must be logged in to release
  if (!userId) {
    return { success: false, reason: '需要登入才能釋放子網域' };
  }

  const record = await getAppRecord(env, appId);
  if (!record) {
    // No record means we can just clean up the subdomain mapping
    await env.MITE_KV.delete(`${SUBDOMAIN_PREFIX}${subdomain}`);
    return { success: true };
  }

  // Only owner can release their deployment
  if (record.user_id === userId) {
    await logSubdomainRelease(env, subdomain, appId, userId);
    await deleteAppRecord(env, appId);
    return { success: true };
  }

  // Anonymous deployment (no user_id) - cannot be released manually
  if (!record.user_id) {
    return { success: false, reason: '匿名部署無法手動釋放，請等待自動過期' };
  }

  // Non-owner trying to release: check cooldown period
  const cooldownHours = 24;
  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  const timeSinceUpdate = Date.now() - new Date(record.updated_at).getTime();

  if (timeSinceUpdate < cooldownMs) {
    const hoursRemaining = Math.ceil((cooldownMs - timeSinceUpdate) / (60 * 60 * 1000));
    return { success: false, reason: `此子網域屬於其他用戶，需等待 ${hoursRemaining} 小時後才能釋放` };
  }

  // Cooldown passed, allow release
  await logSubdomainRelease(env, subdomain, appId, userId);
  await deleteAppRecord(env, appId);

  return { success: true };
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

/**
 * Log subdomain release for audit trail
 */
async function logSubdomainRelease(
  env: Env,
  subdomain: string,
  appId: string,
  userId?: string
): Promise<void> {
  const logKey = `log:release:${subdomain}:${Date.now()}`;
  const logData = {
    subdomain,
    appId,
    userId: userId || 'anonymous',
    timestamp: new Date().toISOString(),
    action: 'release'
  };

  // Store log for 90 days
  await env.MITE_KV.put(
    logKey,
    JSON.stringify(logData),
    { expirationTtl: 90 * 86400 }
  );
}

/**
 * Check if user can release a specific subdomain
 */
export async function canUserReleaseSubdomain(
  env: Env,
  subdomain: string,
  userId: string
): Promise<{ canRelease: boolean; reason?: string }> {
  const check = await checkSubdomainAvailability(env, subdomain);

  if (!check.canRelease) {
    console.log(`canUserRelease: canRelease is false for ${subdomain}`);
    return { canRelease: false, reason: '此子網域無法釋放' };
  }

  const appId = await env.MITE_KV.get(`${SUBDOMAIN_PREFIX}${subdomain}`);
  if (!appId) {
    console.log(`canUserRelease: no appId for ${subdomain}, allowing release`);
    return { canRelease: true };
  }

  const record = await getAppRecord(env, appId);
  if (!record) {
    console.log(`canUserRelease: no record for ${appId}, allowing release`);
    return { canRelease: true };
  }

  console.log(`canUserRelease: record.user_id=${record.user_id}, userId=${userId}, status=${record.status}`);

  // If user owns the deployment, they can always release it
  if (record.user_id === userId) {
    console.log(`canUserRelease: user owns deployment, allowing release`);
    return { canRelease: true };
  }

  // If deployment is failed/expired and has no owner (anonymous), 
  // any logged-in user can release after short cooldown (1 hour)
  if (!record.user_id && (record.status === 'failed' || record.status === 'expired')) {
    const shortCooldownMs = 1 * 60 * 60 * 1000; // 1 hour
    const timeSinceUpdate = Date.now() - new Date(record.updated_at).getTime();
    if (timeSinceUpdate >= shortCooldownMs) {
      console.log(`canUserRelease: anonymous failed deployment, cooldown passed`);
      return { canRelease: true };
    }
  }

  // Check cooldown period for non-owners (24 hours)
  const cooldownHours = 24;
  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  const timeSinceUpdate = Date.now() - new Date(record.updated_at).getTime();

  if (timeSinceUpdate < cooldownMs) {
    const hoursRemaining = Math.ceil((cooldownMs - timeSinceUpdate) / (60 * 60 * 1000));
    console.log(`canUserRelease: cooldown active, ${hoursRemaining} hours remaining`);
    return {
      canRelease: false,
      reason: `冷卻期間中，還需等待 ${hoursRemaining} 小時`
    };
  }

  console.log(`canUserRelease: cooldown passed, allowing release`);
  return { canRelease: true };
}
