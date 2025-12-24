/**
 * Security Headers Utilities
 * Add security-related HTTP headers to responses
 */

export interface SecurityHeadersConfig {
  enableCSP?: boolean;
  enableHSTS?: boolean;
  enableFrameProtection?: boolean;
  cspDirectives?: string;
}

/**
 * Default security headers for all responses
 */
export const DEFAULT_SECURITY_HEADERS: Record<string, string> = {
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // Enable XSS protection (legacy browsers)
  'X-XSS-Protection': '1; mode=block',
  
  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Permissions policy (disable unnecessary features)
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()',
};

/**
 * HSTS header for HTTPS enforcement
 */
export const HSTS_HEADER = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
};

/**
 * Content Security Policy for API responses
 */
export const CSP_HEADER = {
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'"
};

/**
 * Add security headers to a response
 */
export function addSecurityHeaders(
  response: Response,
  config: SecurityHeadersConfig = {}
): Response {
  const headers = new Headers(response.headers);
  
  // Add default security headers
  for (const [key, value] of Object.entries(DEFAULT_SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  
  // Add HSTS if enabled (should only be used on HTTPS)
  if (config.enableHSTS !== false) {
    headers.set('Strict-Transport-Security', HSTS_HEADER['Strict-Transport-Security']);
  }
  
  // Add CSP if enabled
  if (config.enableCSP !== false) {
    const csp = config.cspDirectives || CSP_HEADER['Content-Security-Policy'];
    headers.set('Content-Security-Policy', csp);
  }
  
  // Frame protection
  if (config.enableFrameProtection !== false) {
    headers.set('X-Frame-Options', 'DENY');
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * Create a secure error response
 */
export function createSecureErrorResponse(
  statusCode: number,
  message: string,
  isProduction: boolean = true
): Response {
  // In production, use generic error messages
  const errorMessage = isProduction && statusCode >= 500
    ? 'An internal error occurred. Please try again later.'
    : message;
  
  const response = new Response(
    JSON.stringify({
      error: {
        code: statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
        message: errorMessage
      }
    }),
    {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
  
  return addSecurityHeaders(response);
}
