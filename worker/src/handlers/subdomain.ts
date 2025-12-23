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
  SubdomainCheckResult 
} from '../utils/kv';

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

  const normalizedSubdomain = subdomain.toLowerCase();
  
  // Validate subdomain format
  if (!SUBDOMAIN_REGEX.test(normalizedSubdomain)) {
    throw new ApiError(400, 'Invalid subdomain format');
  }

  const released = await releaseStaleSubdomain(env, normalizedSubdomain);
  
  if (!released) {
    throw new ApiError(409, 'Subdomain cannot be released - it is either in active use or reserved');
  }

  return new Response(JSON.stringify({
    success: true,
    subdomain: normalizedSubdomain,
    message: 'Subdomain has been released and is now available'
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
