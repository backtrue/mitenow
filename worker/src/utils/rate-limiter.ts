/**
 * Rate Limiting Utilities
 * Protect API endpoints from abuse and DDoS attacks
 */

import type { Env } from '../types';
import { ApiError } from '../types';

interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
  keyPrefix: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // File upload preparation
  'prepare': {
    maxRequests: 10,
    windowSeconds: 60,
    keyPrefix: 'rl:prepare'
  },
  
  // Deployment trigger
  'deploy': {
    maxRequests: 5,
    windowSeconds: 60,
    keyPrefix: 'rl:deploy'
  },
  
  // File upload
  'upload': {
    maxRequests: 3,
    windowSeconds: 60,
    keyPrefix: 'rl:upload'
  },
  
  // Status check
  'status': {
    maxRequests: 30,
    windowSeconds: 60,
    keyPrefix: 'rl:status'
  },
  
  // Subdomain operations
  'subdomain': {
    maxRequests: 20,
    windowSeconds: 60,
    keyPrefix: 'rl:subdomain'
  },
  
  // Authentication
  'auth': {
    maxRequests: 10,
    windowSeconds: 300, // 5 minutes
    keyPrefix: 'rl:auth'
  },
  
  // Global rate limit (per IP)
  'global': {
    maxRequests: 100,
    windowSeconds: 60,
    keyPrefix: 'rl:global'
  }
};

/**
 * Get client identifier (IP address or user ID)
 */
function getClientIdentifier(request: Request, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }
  
  // Try to get real IP from Cloudflare headers
  const cfConnectingIp = request.headers.get('CF-Connecting-IP');
  if (cfConnectingIp) {
    return `ip:${cfConnectingIp}`;
  }
  
  // Fallback to X-Forwarded-For
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  if (xForwardedFor) {
    const ip = xForwardedFor.split(',')[0].trim();
    return `ip:${ip}`;
  }
  
  // Last resort: use a generic identifier
  return 'ip:unknown';
}

/**
 * Check rate limit using KV storage
 */
export async function checkRateLimit(
  env: Env,
  request: Request,
  endpoint: string,
  userId?: string
): Promise<RateLimitResult> {
  const config = RATE_LIMIT_CONFIGS[endpoint];
  if (!config) {
    // No rate limit configured for this endpoint
    return {
      allowed: true,
      remaining: 999,
      resetAt: Date.now() + 60000
    };
  }
  
  const clientId = getClientIdentifier(request, userId);
  const key = `${config.keyPrefix}:${clientId}`;
  const now = Date.now();
  
  // Get current request count from KV
  const data = await env.MITE_KV.get(key, { type: 'json' }) as {
    count: number;
    resetAt: number;
  } | null;
  
  // If no data or window expired, start fresh
  if (!data || data.resetAt < now) {
    const resetAt = now + (config.windowSeconds * 1000);
    await env.MITE_KV.put(
      key,
      JSON.stringify({ count: 1, resetAt }),
      { expirationTtl: config.windowSeconds + 10 } // Add 10s buffer
    );
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt
    };
  }
  
  // Check if limit exceeded
  if (data.count >= config.maxRequests) {
    const retryAfter = Math.ceil((data.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: data.resetAt,
      retryAfter
    };
  }
  
  // Increment counter
  const newCount = data.count + 1;
  await env.MITE_KV.put(
    key,
    JSON.stringify({ count: newCount, resetAt: data.resetAt }),
    { expirationTtl: config.windowSeconds + 10 }
  );
  
  return {
    allowed: true,
    remaining: config.maxRequests - newCount,
    resetAt: data.resetAt
  };
}

/**
 * Rate limit middleware - throws ApiError if limit exceeded
 */
export async function enforceRateLimit(
  env: Env,
  request: Request,
  endpoint: string,
  userId?: string
): Promise<void> {
  // Check endpoint-specific rate limit
  const endpointResult = await checkRateLimit(env, request, endpoint, userId);
  
  // Check global rate limit
  const globalResult = await checkRateLimit(env, request, 'global', userId);
  
  // Use the more restrictive limit
  const result = !endpointResult.allowed ? endpointResult : 
                 !globalResult.allowed ? globalResult : 
                 endpointResult;
  
  if (!result.allowed) {
    throw new ApiError(
      429,
      `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
      'RATE_LIMIT_EXCEEDED'
    );
  }
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: Response,
  result: RateLimitResult
): Response {
  const headers = new Headers(response.headers);
  
  headers.set('X-RateLimit-Limit', String(result.remaining + 1));
  headers.set('X-RateLimit-Remaining', String(result.remaining));
  headers.set('X-RateLimit-Reset', String(Math.floor(result.resetAt / 1000)));
  
  if (result.retryAfter) {
    headers.set('Retry-After', String(result.retryAfter));
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * User-based rate limiting for authenticated endpoints
 * More generous limits for authenticated users
 */
export const USER_RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  'deploy': {
    maxRequests: 50,
    windowSeconds: 86400, // 24 hours
    keyPrefix: 'rl:user:deploy'
  },
  
  'upload': {
    maxRequests: 100,
    windowSeconds: 86400,
    keyPrefix: 'rl:user:upload'
  }
};

/**
 * Check user-based daily rate limit
 */
export async function checkUserDailyLimit(
  env: Env,
  userId: string,
  action: 'deploy' | 'upload'
): Promise<RateLimitResult> {
  const config = USER_RATE_LIMIT_CONFIGS[action];
  const key = `${config.keyPrefix}:${userId}`;
  const now = Date.now();
  
  const data = await env.MITE_KV.get(key, { type: 'json' }) as {
    count: number;
    resetAt: number;
  } | null;
  
  if (!data || data.resetAt < now) {
    const resetAt = now + (config.windowSeconds * 1000);
    await env.MITE_KV.put(
      key,
      JSON.stringify({ count: 1, resetAt }),
      { expirationTtl: config.windowSeconds + 10 }
    );
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt
    };
  }
  
  if (data.count >= config.maxRequests) {
    const retryAfter = Math.ceil((data.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: data.resetAt,
      retryAfter
    };
  }
  
  const newCount = data.count + 1;
  await env.MITE_KV.put(
    key,
    JSON.stringify({ count: newCount, resetAt: data.resetAt }),
    { expirationTtl: config.windowSeconds + 10 }
  );
  
  return {
    allowed: true,
    remaining: config.maxRequests - newCount,
    resetAt: data.resetAt
  };
}
