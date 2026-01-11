/**
 * GET /api/v1/subdomain/check/:subdomain
 * POST /api/v1/subdomain/release/:subdomain
 * Check subdomain availability and release stale subdomains
 */

import type { Env } from '../types';
import { ApiError } from '../types';
import {
  checkSubdomainAvailability,
  releaseStaleSubdomain,
  canUserReleaseSubdomain,
  SubdomainCheckResult
} from '../utils/kv';
import { getCurrentUser } from './auth';

// Subdomain validation regex
const SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export interface SubdomainCheckResponse {
  subdomain: string;
  available: boolean;
  reason?: string;
  canRelease?: boolean;
  message: string;
}

/**
 * Check if a subdomain is available
 */
export async function handleSubdomainCheck(
  request: Request,
  env: Env,
  subdomain: string
): Promise<Response> {
  if (request.method !== 'GET') {
    throw new ApiError(405, 'Method not allowed');
  }

  // Validate subdomain format
  const normalizedSubdomain = subdomain.toLowerCase();
  if (!SUBDOMAIN_REGEX.test(normalizedSubdomain)) {
    const response: SubdomainCheckResponse = {
      subdomain: normalizedSubdomain,
      available: false,
      reason: 'invalid_format',
      message: '子網域格式無效，只能用小寫字母、數字和連字元 (1-63 字元)'
    };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const result = await checkSubdomainAvailability(env, normalizedSubdomain);

  const response: SubdomainCheckResponse = {
    subdomain: normalizedSubdomain,
    available: result.available,
    reason: result.reason,
    canRelease: result.canRelease,
    message: getAvailabilityMessage(result)
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Release a stale subdomain
 */
export async function handleSubdomainRelease(
  request: Request,
  env: Env,
  subdomain: string
): Promise<Response> {
  if (request.method !== 'POST') {
    throw new ApiError(405, 'Method not allowed');
  }

  // Get current user (must be logged in)
  const user = await getCurrentUser(request, env);
  const userId = user?.id;

  if (!userId) {
    throw new ApiError(401, '需要登入才能釋放子網域');
  }

  // Try to release - this function handles all logic and returns error reason
  const result = await releaseStaleSubdomain(env, subdomain, userId);

  if (!result.success) {
    throw new ApiError(403, result.reason || '無法釋放此子網域');
  }

  return new Response(JSON.stringify({
    success: true,
    subdomain,
    message: '子網域釋放成功'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

function getAvailabilityMessage(result: SubdomainCheckResult): string {
  if (result.available) {
    return '子網域可以使用';
  }

  switch (result.reason) {
    case 'reserved':
      return '此子網域已保留，無法使用';
    case 'in_use':
      return '此子網域已被其他部署使用中';
    case 'stale_failed':
      return '此子網域之前部署失敗，可以釋放並使用';
    default:
      return '子網域無法使用';
  }
}
