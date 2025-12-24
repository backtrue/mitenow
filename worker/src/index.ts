/**
 * mite.now - Cloudflare Worker Entry Point
 * 
 * Main router handling:
 * - API endpoints (/api/v1/*)
 * - Wildcard subdomain routing (*.mite.now)
 */

import type { Env } from './types';
import { ApiError } from './types';
import { handlePrepare, handleUpload } from './handlers/prepare';
import { handleDeploy } from './handlers/deploy';
import { handleStatus } from './handlers/status';
import { handleWildcardProxy } from './handlers/proxy';
import { handleCloudBuildWebhook } from './handlers/webhook';
import { handleSubdomainCheck, handleSubdomainRelease } from './handlers/subdomain';
import {
  handleAdminListDeployments,
  handleAdminGetDeployment,
  handleAdminDeleteDeployment,
  handleAdminStats
} from './handlers/admin';
import {
  handleAuthLogin,
  handleAuthCallback,
  handleAuthMe,
  handleAuthLogout,
} from './handlers/auth';
import {
  handleCreateCheckout,
  handleCustomerPortal,
  handleAddQuotaPack,
  handleStripeWebhook,
} from './handlers/stripe';
import { handleScheduledCleanup } from './handlers/scheduled';
import { enforceRateLimit } from './utils/rate-limiter';
import { addSecurityHeaders } from './utils/security-headers';
import {
  handleListDeployments,
  handleGetDeployment,
  handleDeleteDeployment,
} from './handlers/deployments';
import {
  captureError,
  createRequestTracker,
  getHealthMetrics,
  trackRateLimit,
} from './utils/monitoring';

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const hostname = url.hostname;

    try {
      // Determine if this is an API request or a wildcard subdomain request
      const isApiRequest = hostname === 'api.mite.now' ||
        hostname === 'localhost' ||
        hostname.startsWith('127.0.0.1') ||
        url.pathname.startsWith('/api/');

      if (isApiRequest) {
        return await handleApiRequest(request, env, url);
      }

      // Handle main domain (mite.now) - proxy to Cloudflare Pages
      if (hostname === 'mite.now' || hostname === 'www.mite.now') {
        return await proxyToPages(request);
      }

      // Handle wildcard subdomain routing
      return await handleWildcardProxy(request, env);

    } catch (error) {
      // Include CORS headers in error responses for API requests
      return handleError(error, request, env);
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    await handleScheduledCleanup(event, env, ctx);
  }
};

/**
 * Route API requests to appropriate handlers
 */
async function handleApiRequest(
  request: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const path = url.pathname;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return handleCors(request, env);
  }

  // Add CORS headers to response
  const corsHeaders = getCorsHeaders(request, env);

  let response: Response;

  // Route to handlers
  if (path === '/api/v1/prepare') {
    await enforceRateLimit(env, request, 'prepare');
    response = await handlePrepare(request, env);

  } else if (path.startsWith('/api/v1/upload/')) {
    await enforceRateLimit(env, request, 'upload');
    const appId = path.split('/')[4];
    const token = url.searchParams.get('token') || '';
    response = await handleUpload(request, env, appId, token);

  } else if (path === '/api/v1/deploy') {
    await enforceRateLimit(env, request, 'deploy');
    response = await handleDeploy(request, env);

  } else if (path.startsWith('/api/v1/status/')) {
    await enforceRateLimit(env, request, 'status');
    const appId = path.split('/')[4];
    response = await handleStatus(request, env, appId);

  } else if (path === '/api/v1/webhook/cloudbuild') {
    response = await handleCloudBuildWebhook(request, env);

  } else if (path.startsWith('/api/v1/subdomain/check/')) {
    await enforceRateLimit(env, request, 'subdomain');
    const subdomain = path.split('/')[5];
    response = await handleSubdomainCheck(request, env, subdomain);

  } else if (path.startsWith('/api/v1/subdomain/release/')) {
    await enforceRateLimit(env, request, 'subdomain');
    const subdomain = path.split('/')[5];
    response = await handleSubdomainRelease(request, env, subdomain);

  } else if (path === '/api/v1/health') {
    // Enhanced health check with service status
    const healthMetrics = await getHealthMetrics(env);
    response = new Response(JSON.stringify(healthMetrics), {
      status: healthMetrics.status === 'healthy' ? 200 : 503,
      headers: { 'Content-Type': 'application/json' }
    });

    // Auth endpoints
  } else if (path === '/api/v1/auth/login') {
    await enforceRateLimit(env, request, 'auth');
    response = await handleAuthLogin(request, env);

  } else if (path === '/api/v1/auth/callback') {
    await enforceRateLimit(env, request, 'auth');
    response = await handleAuthCallback(request, env);

  } else if (path === '/api/v1/auth/me') {
    response = await handleAuthMe(request, env);

  } else if (path === '/api/v1/auth/logout') {
    response = await handleAuthLogout(request, env);

    // Stripe endpoints
  } else if (path === '/api/v1/subscription/checkout') {
    response = await handleCreateCheckout(request, env);

  } else if (path === '/api/v1/subscription/portal') {
    response = await handleCustomerPortal(request, env);

  } else if (path === '/api/v1/subscription/quota') {
    response = await handleAddQuotaPack(request, env);

  } else if (path === '/api/v1/webhook/stripe') {
    response = await handleStripeWebhook(request, env);

    // User deployments endpoints
  } else if (path === '/api/v1/deployments') {
    response = await handleListDeployments(request, env);

  } else if (path.startsWith('/api/v1/deployments/') && !path.includes('/admin/')) {
    const deploymentId = path.split('/')[4];
    if (request.method === 'DELETE') {
      response = await handleDeleteDeployment(request, env, deploymentId);
    } else {
      response = await handleGetDeployment(request, env, deploymentId);
    }

    // Admin endpoints
  } else if (path === '/api/v1/admin/deployments') {
    response = await handleAdminListDeployments(request, env);

  } else if (path === '/api/v1/admin/stats') {
    response = await handleAdminStats(request, env);

  } else if (path.startsWith('/api/v1/admin/deployments/')) {
    const appId = path.split('/')[5];
    if (request.method === 'DELETE') {
      response = await handleAdminDeleteDeployment(request, env, appId);
    } else {
      response = await handleAdminGetDeployment(request, env, appId);
    }

  } else {
    throw new ApiError(404, 'Endpoint not found');
  }

  // Add CORS headers to response
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value);
  }

  const responseWithCors = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });

  // Add security headers
  return addSecurityHeaders(responseWithCors);
}

/**
 * Handle CORS preflight requests
 */
function handleCors(request: Request, env: Env): Response {
  const corsHeaders = getCorsHeaders(request, env);

  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders,
      'Access-Control-Max-Age': '86400'
    }
  });
}

/**
 * Get CORS headers based on request origin
 */
function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '';

  // Strict whitelist of allowed origins - no wildcards
  const allowedOrigins = (env.ALLOWED_ORIGINS || 'https://mite.now,https://www.mite.now,http://localhost:3000')
    .split(',')
    .map(o => o.trim());

  // Exact match only - no subdomain wildcards for security
  const isAllowed = allowedOrigins.includes(origin);

  // If origin not allowed, use first allowed origin as fallback
  const allowedOrigin = isAllowed ? origin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true'
  };
}

/**
 * Proxy requests to Cloudflare Pages (main frontend)
 */
async function proxyToPages(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pagesUrl = `https://mite-frontend.pages.dev${url.pathname}${url.search}`;

  const response = await fetch(pagesUrl, {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/**
 * Handle errors and return appropriate response with CORS headers
 */
async function handleError(error: unknown, request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  // Determine if we're in production
  const isProduction = env.ENVIRONMENT === 'production' || !env.ENVIRONMENT;

  // Capture error to Sentry (non-blocking)
  captureError(error, {
    endpoint: url.pathname,
    method: request.method,
  }).catch(() => { }); // Ignore Sentry errors

  console.error('Request error:', error);

  if (error instanceof ApiError) {
    // Track rate limit hits specifically
    if (error.code === 'RATE_LIMIT_EXCEEDED') {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      trackRateLimit(ip, url.pathname).catch(() => { });
    }

    const response = new Response(JSON.stringify({
      error: {
        code: error.code,
        message: error.message
      }
    }), {
      status: error.statusCode,
      headers: { 'Content-Type': 'application/json' }
    });

    return addSecurityHeaders(response);
  }

  // For internal errors, use generic message in production
  const errorMessage = isProduction
    ? 'An internal error occurred. Please try again later.'
    : error instanceof Error ? error.message : 'An unexpected error occurred';

  const response = new Response(JSON.stringify({
    error: {
      code: 'INTERNAL_ERROR',
      message: errorMessage
    }
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' }
  });

  return addSecurityHeaders(response);
}
