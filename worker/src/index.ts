/**
 * mite.now - Cloudflare Worker Entry Point
 * 
 * Main router handling:
 * - API endpoints (/api/v1/*)
 * - Wildcard subdomain routing (*.mite.now)
 */

import type { Env, ErrorResponse } from './types';
import { ApiError } from './types';
import { handlePrepare, handleUpload } from './handlers/prepare';
import { handleDeploy } from './handlers/deploy';
import { handleStatus } from './handlers/status';
import { handleWildcardProxy } from './handlers/proxy';
import { handleCloudBuildWebhook } from './handlers/webhook';
import { handleSubdomainCheck, handleSubdomainRelease } from './handlers/subdomain';

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
    response = await handlePrepare(request, env);
    
  } else if (path.startsWith('/api/v1/upload/')) {
    const appId = path.split('/')[4];
    const token = url.searchParams.get('token') || '';
    response = await handleUpload(request, env, appId, token);
    
  } else if (path === '/api/v1/deploy') {
    response = await handleDeploy(request, env);
    
  } else if (path.startsWith('/api/v1/status/')) {
    const appId = path.split('/')[4];
    response = await handleStatus(request, env, appId);
    
  } else if (path === '/api/v1/webhook/cloudbuild') {
    response = await handleCloudBuildWebhook(request, env);
    
  } else if (path.startsWith('/api/v1/subdomain/check/')) {
    const subdomain = path.split('/')[5];
    response = await handleSubdomainCheck(request, env, subdomain);
    
  } else if (path.startsWith('/api/v1/subdomain/release/')) {
    const subdomain = path.split('/')[5];
    response = await handleSubdomainRelease(request, env, subdomain);
    
  } else if (path === '/api/v1/health') {
    response = new Response(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString() 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } else {
    throw new ApiError(404, 'Endpoint not found');
  }
  
  // Add CORS headers to response
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value);
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
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
  const allowedOrigins = (env.ALLOWED_ORIGINS || 'https://mite.now,http://localhost:3000')
    .split(',')
    .map(o => o.trim());
  
  // Check if origin is allowed
  const isAllowed = allowedOrigins.some(allowed => {
    if (allowed === '*') return true;
    if (allowed === origin) return true;
    // Allow subdomains of mite.now
    if (origin.endsWith('.mite.now')) return true;
    return false;
  });
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
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
function handleError(error: unknown, request: Request, env: Env): Response {
  console.error('Request error:', error);
  
  // Get CORS headers for the response
  const corsHeaders = getCorsHeaders(request, env);
  
  if (error instanceof ApiError) {
    const errorResponse: ErrorResponse = {
      error: {
        code: error.code || 'ERROR',
        message: error.message
      }
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: error.statusCode,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
  
  // Generic error
  const errorResponse: ErrorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  };
  
  return new Response(JSON.stringify(errorResponse), {
    status: 500,
    headers: { 
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}
