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
      message: 'Subdomain must be 1-63 characters, lowercase alphanumeric and hyphens only, cannot start or end with hyphen'
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
  
  // Get current user (optional - anonymous users can release after cooldown)
  const user = await getCurrentUser(request, env);
  const userId = user?.id;
  
  // Check if user can release this subdomain
  if (userId) {
    const canRelease = await canUserReleaseSubdomain(env, subdomain, userId);
    if (!canRelease.canRelease) {
      throw new ApiError(403, canRelease.reason || 'Cannot release this subdomain');
    }
  }
  
  const released = await releaseStaleSubdomain(env, subdomain, userId);
  
  if (!released) {
    throw new ApiError(400, 'Subdomain cannot be released. It may be active or not exist.');
  }
  
  return new Response(JSON.stringify({
    success: true,
    subdomain,
    message: 'Subdomain released successfully'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

function getAvailabilityMessage(result: SubdomainCheckResult): string {
  if (result.available) {
    return 'Subdomain is available';
  }
  
  switch (result.reason) {
    case 'reserved':
      return 'This subdomain is reserved and cannot be used';
    case 'in_use':
      return 'This subdomain is currently in use by an active deployment';
    case 'stale_failed':
      return 'This subdomain was used by a failed deployment and can be released';
    default:
      return 'Subdomain is not available';
  }
}
