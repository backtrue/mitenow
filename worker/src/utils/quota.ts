/**
 * Quota Management Utilities
 * Handle deployment limits for free and pro users
 */

import type { Env, User, UserQuota } from '../types';
import { ApiError, QUOTA_LIMITS, FREE_TTL_HOURS } from '../types';

/**
 * Get user's quota information
 */
export async function getUserQuota(env: Env, userId: string): Promise<UserQuota> {
  // Get user
  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(userId).first<User>();

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Count current deployments
  const countResult = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM deployments WHERE user_id = ?'
  ).bind(userId).first<{ count: number }>();

  const currentDeployments = countResult?.count || 0;
  const maxDeployments = calculateMaxDeployments(user);

  return {
    max_deployments: maxDeployments,
    current_deployments: currentDeployments,
    remaining: Math.max(0, maxDeployments - currentDeployments),
    expires_in_hours: user.subscription_tier === 'free' ? FREE_TTL_HOURS : null,
  };
}

/**
 * Check if user can create a new deployment
 */
export async function canCreateDeployment(env: Env, userId: string | null): Promise<boolean> {
  // Anonymous users can always deploy (legacy support)
  if (!userId) {
    return true;
  }

  const quota = await getUserQuota(env, userId);
  return quota.remaining > 0;
}

/**
 * Check quota and throw error if exceeded
 */
export async function checkQuotaOrThrow(env: Env, userId: string | null): Promise<void> {
  if (!userId) {
    return; // Anonymous users bypass quota
  }

  const quota = await getUserQuota(env, userId);

  if (quota.remaining <= 0) {
    throw new ApiError(
      403,
      `Deployment quota exceeded. You have ${quota.current_deployments}/${quota.max_deployments} deployments. Please upgrade or delete existing deployments.`,
      'QUOTA_EXCEEDED'
    );
  }
}

/**
 * Calculate max deployments for a user
 */
export function calculateMaxDeployments(user: User): number {
  if (user.subscription_tier === 'free') {
    return QUOTA_LIMITS.free;
  }

  // Pro: base + extra packs
  return QUOTA_LIMITS.pro + (user.extra_quota_packs * QUOTA_LIMITS.per_pack);
}

/**
 * Calculate expiration time for a deployment
 */
export function calculateExpiresAt(user: User | null): number | null {
  // Anonymous or free users get TTL
  if (!user || user.subscription_tier === 'free') {
    return Date.now() + (FREE_TTL_HOURS * 60 * 60 * 1000);
  }

  // Pro users: no expiration
  return null;
}

/**
 * Get deployments that are about to expire (for notification)
 */
export async function getExpiringDeployments(
  env: Env,
  hoursUntilExpiry: number = 24
): Promise<Array<{ id: string; subdomain: string; user_id: string; expires_at: number }>> {
  const now = Date.now();
  const threshold = now + (hoursUntilExpiry * 60 * 60 * 1000);

  const result = await env.DB.prepare(`
    SELECT id, subdomain, user_id, expires_at 
    FROM deployments 
    WHERE expires_at IS NOT NULL 
      AND expires_at > ? 
      AND expires_at <= ?
  `).bind(now, threshold).all();

  return result.results as Array<{ id: string; subdomain: string; user_id: string; expires_at: number }>;
}

/**
 * Get expired deployments for cleanup
 */
export async function getExpiredDeployments(
  env: Env
): Promise<Array<{ id: string; subdomain: string; cloud_run_url: string | null; d1_database_id: string | null }>> {
  const now = Date.now();

  const result = await env.DB.prepare(`
    SELECT id, subdomain, cloud_run_url, d1_database_id 
    FROM deployments 
    WHERE expires_at IS NOT NULL AND expires_at <= ?
  `).bind(now).all();

  return result.results as Array<{ id: string; subdomain: string; cloud_run_url: string | null; d1_database_id: string | null }>;
}

/**
 * Delete a deployment from D1
 */
export async function deleteDeploymentFromD1(env: Env, deploymentId: string): Promise<void> {
  await env.DB.prepare('DELETE FROM deployments WHERE id = ?')
    .bind(deploymentId)
    .run();
}

/**
 * Create deployment record in D1
 */
export async function createDeploymentInD1(
  env: Env,
  deployment: {
    id: string;
    user_id: string | null;
    subdomain: string;
    framework: string;
    status: string;
  }
): Promise<void> {
  const now = Date.now();

  // Get user to determine expiration
  let expiresAt: number | null = null;
  if (deployment.user_id) {
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(deployment.user_id).first<User>();
    expiresAt = calculateExpiresAt(user);
  } else {
    // Anonymous: 72 hour TTL
    expiresAt = Date.now() + (FREE_TTL_HOURS * 60 * 60 * 1000);
  }

  await env.DB.prepare(`
    INSERT INTO deployments (
      id, user_id, subdomain, framework, status, 
      has_database, expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).bind(
    deployment.id,
    deployment.user_id,
    deployment.subdomain,
    deployment.framework,
    deployment.status,
    expiresAt,
    now,
    now
  ).run();
}

/**
 * Update deployment status in D1
 */
export async function updateDeploymentInD1(
  env: Env,
  deploymentId: string,
  updates: {
    status?: string;
    cloud_run_url?: string;
    has_database?: boolean;
    d1_database_id?: string;
  }
): Promise<void> {
  const setClauses: string[] = ['updated_at = ?'];
  const values: (string | number | null)[] = [Date.now()];

  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    values.push(updates.status);
  }

  if (updates.cloud_run_url !== undefined) {
    setClauses.push('cloud_run_url = ?');
    values.push(updates.cloud_run_url);
  }

  if (updates.has_database !== undefined) {
    setClauses.push('has_database = ?');
    values.push(updates.has_database ? 1 : 0);
  }

  if (updates.d1_database_id !== undefined) {
    setClauses.push('d1_database_id = ?');
    values.push(updates.d1_database_id);
  }

  values.push(deploymentId);

  await env.DB.prepare(`
    UPDATE deployments SET ${setClauses.join(', ')} WHERE id = ?
  `).bind(...values).run();
}

/**
 * Remove expiration from all deployments for a user
 * Called when user upgrades to Pro
 */
export async function removeExpirationForUser(env: Env, userId: string): Promise<number> {
  const now = Date.now();

  const result = await env.DB.prepare(`
    UPDATE deployments 
    SET expires_at = NULL, updated_at = ? 
    WHERE user_id = ? AND expires_at IS NOT NULL AND status != 'failed'
  `).bind(now, userId).run();

  console.log(`Removed expiration from ${result.meta.changes} deployments for user ${userId}`);
  return result.meta.changes || 0;
}
