/**
 * Wildcard Routing Handler
 * Reverse proxy requests from *.mite.now to Cloud Run services
 */

import type { Env } from '../types';
import { getRoutingInfo, getAppBySubdomain } from '../utils/kv';

// Headers to skip when proxying
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host'
]);

export async function handleWildcardProxy(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const hostname = url.hostname;
  
  // Extract subdomain from hostname
  // e.g., "my-app.mite.now" -> "my-app"
  const parts = hostname.split('.');
  const subdomain = parts[0];
  
  // Skip main site and reserved subdomains
  const reservedSubdomains = ['www', 'api', 'mite', 'app', 'admin', 'static'];
  if (reservedSubdomains.includes(subdomain)) {
    // Serve static assets for main site
    return env.ASSETS.fetch(request);
  }
  
  // Get routing info from KV
  const routingInfo = await getRoutingInfo(env, subdomain);
  
  if (!routingInfo) {
    // Check if app exists but is not active
    const appRecord = await getAppBySubdomain(env, subdomain);
    
    if (appRecord) {
      return createStatusPage(appRecord.status, subdomain, appRecord.error);
    }
    
    return createNotFoundPage(subdomain);
  }
  
  // Build proxied request
  const targetUrl = new URL(routingInfo.targetUrl);
  targetUrl.pathname = url.pathname;
  targetUrl.search = url.search;
  
  // Create new headers, filtering hop-by-hop headers
  const proxyHeaders = new Headers();
  for (const [key, value] of request.headers) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      proxyHeaders.set(key, value);
    }
  }
  
  // Set forwarded headers
  proxyHeaders.set('X-Forwarded-Host', hostname);
  proxyHeaders.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
  proxyHeaders.set('X-Real-IP', request.headers.get('CF-Connecting-IP') || '');
  proxyHeaders.set('X-Mite-App-Id', routingInfo.appId);
  
  // Create proxied request
  const proxyRequest = new Request(targetUrl.toString(), {
    method: request.method,
    headers: proxyHeaders,
    body: request.body,
    redirect: 'manual'
  });
  
  try {
    // Fetch from Cloud Run
    const response = await fetch(proxyRequest);
    
    // Create response with modified headers
    const responseHeaders = new Headers(response.headers);
    
    // Remove Cloud Run specific headers
    responseHeaders.delete('x-cloud-trace-context');
    responseHeaders.delete('x-served-by');
    
    // Add CORS headers if needed
    responseHeaders.set('X-Powered-By', 'mite.now');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
    
  } catch (error) {
    console.error(`Proxy error for ${subdomain}:`, error);
    return createErrorPage(subdomain);
  }
}

/**
 * Create a status page for apps that are not yet active
 */
function createStatusPage(
  status: string,
  subdomain: string,
  error?: string
): Response {
  const statusMessages: Record<string, { title: string; message: string; color: string }> = {
    pending: {
      title: 'Preparing...',
      message: 'Your app is being prepared for deployment.',
      color: '#3b82f6'
    },
    analyzing: {
      title: 'Analyzing...',
      message: 'We\'re analyzing your application code.',
      color: '#8b5cf6'
    },
    building: {
      title: 'Building...',
      message: 'Your app is being built. This usually takes 1-2 minutes.',
      color: '#f59e0b'
    },
    deploying: {
      title: 'Deploying...',
      message: 'Almost there! Your app is being deployed to the cloud.',
      color: '#10b981'
    },
    failed: {
      title: 'Deployment Failed',
      message: error || 'Something went wrong during deployment.',
      color: '#ef4444'
    },
    expired: {
      title: 'App Expired',
      message: 'This app has expired and is no longer available.',
      color: '#6b7280'
    }
  };
  
  const info = statusMessages[status] || statusMessages.pending;
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${info.title} - ${subdomain}.mite.now</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 500px;
    }
    .status-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: ${info.color};
      margin: 0 auto 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: ${status === 'failed' ? 'none' : 'pulse 2s infinite'};
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.05); opacity: 0.8; }
    }
    h1 { font-size: 1.75rem; margin-bottom: 0.5rem; }
    p { color: #a0aec0; line-height: 1.6; }
    .subdomain {
      font-family: monospace;
      background: rgba(255,255,255,0.1);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      margin-top: 1rem;
      display: inline-block;
    }
    .refresh {
      margin-top: 2rem;
      color: #60a5fa;
      text-decoration: none;
    }
    .refresh:hover { text-decoration: underline; }
  </style>
  ${status !== 'failed' && status !== 'expired' ? '<meta http-equiv="refresh" content="5">' : ''}
</head>
<body>
  <div class="container">
    <div class="status-icon">
      ${status === 'failed' ? '✕' : status === 'expired' ? '⏱' : '⟳'}
    </div>
    <h1>${info.title}</h1>
    <p>${info.message}</p>
    <div class="subdomain">${subdomain}.mite.now</div>
    ${status !== 'failed' && status !== 'expired' ? '<p style="margin-top:1rem;font-size:0.875rem;color:#718096;">Page will refresh automatically...</p>' : ''}
  </div>
</body>
</html>`;
  
  return new Response(html, {
    status: status === 'failed' ? 503 : 202,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}

/**
 * Create a 404 page for unknown subdomains
 */
function createNotFoundPage(subdomain: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Not Found - mite.now</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container { text-align: center; padding: 2rem; }
    h1 { font-size: 6rem; font-weight: 200; color: #4a5568; }
    h2 { margin: 1rem 0; }
    p { color: #a0aec0; }
    a {
      display: inline-block;
      margin-top: 2rem;
      padding: 0.75rem 1.5rem;
      background: #3b82f6;
      color: #fff;
      text-decoration: none;
      border-radius: 8px;
      transition: background 0.2s;
    }
    a:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div class="container">
    <h1>404</h1>
    <h2>App Not Found</h2>
    <p>The app "${subdomain}" doesn't exist or has been removed.</p>
    <a href="https://mite.now">Create Your Own App →</a>
  </div>
</body>
</html>`;
  
  return new Response(html, {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

/**
 * Create an error page for proxy failures
 */
function createErrorPage(subdomain: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Service Unavailable - mite.now</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container { text-align: center; padding: 2rem; }
    h1 { font-size: 4rem; font-weight: 200; color: #f59e0b; }
    h2 { margin: 1rem 0; }
    p { color: #a0aec0; max-width: 400px; line-height: 1.6; }
    .retry {
      display: inline-block;
      margin-top: 2rem;
      padding: 0.75rem 1.5rem;
      background: #3b82f6;
      color: #fff;
      text-decoration: none;
      border-radius: 8px;
      cursor: pointer;
      border: none;
      font-size: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>503</h1>
    <h2>Service Temporarily Unavailable</h2>
    <p>The app "${subdomain}" is currently waking up or experiencing issues. This usually resolves within a few seconds.</p>
    <button class="retry" onclick="location.reload()">Try Again</button>
  </div>
</body>
</html>`;
  
  return new Response(html, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Retry-After': '5'
    }
  });
}
