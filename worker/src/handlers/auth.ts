/**
 * Authentication Handlers
 * Google OAuth 2.0 login flow
 */

import type { Env, User } from '../types';
import { ApiError } from '../types';
import {
  createSession,
  validateSessionAndGetUser,
  deleteSession,
  getSessionCookieConfig,
  getSessionDeletionCookie,
} from '../utils/session-manager';

const SUPER_ADMIN_EMAIL = 'backtrue@gmail.com';

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

/**
 * Generate Google OAuth login URL
 */
export async function handleAuthLogin(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/v1/auth/callback`;
  
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  
  return Response.redirect(authUrl, 302);
}

/**
 * Handle Google OAuth callback
 */
export async function handleAuthCallback(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  
  if (error) {
    return redirectWithError(url.origin, `OAuth error: ${error}`);
  }
  
  if (!code) {
    return redirectWithError(url.origin, 'No authorization code received');
  }
  
  try {
    // Exchange code for tokens
    const redirectUri = `${url.origin}/api/v1/auth/callback`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return redirectWithError(url.origin, 'Failed to exchange authorization code');
    }
    
    const tokens: GoogleTokenResponse = await tokenResponse.json();
    
    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    
    if (!userInfoResponse.ok) {
      return redirectWithError(url.origin, 'Failed to get user info');
    }
    
    const googleUser: GoogleUserInfo = await userInfoResponse.json();
    
    // Create or update user in D1
    const user = await upsertUser(env, googleUser);
    
    // Create session
    const sessionToken = await createSession(env, user.id);
    
    // Redirect to dashboard with session cookie
    const dashboardUrl = user.role === 'super_admin' ? '/admin' : '/dashboard';
    const response = new Response(null, {
      status: 302,
      headers: {
        Location: dashboardUrl,
        'Set-Cookie': getSessionCookieConfig(sessionToken),
      },
    });
    
    return response;
  } catch (err) {
    console.error('Auth callback error:', err);
    return redirectWithError(url.origin, 'Authentication failed');
  }
}

/**
 * Get current user info
 */
export async function handleAuthMe(
  request: Request,
  env: Env
): Promise<Response> {
  const result = await getCurrentUserWithRotation(request, env);
  
  if (!result) {
    throw new ApiError(401, 'Not authenticated');
  }
  
  const { user, newSessionId } = result;
  
  // Get user's deployment count
  const deploymentCount = await getUserDeploymentCount(env, user.id);
  const maxDeployments = getMaxDeployments(user);
  
  const response = Response.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      role: user.role,
      subscription_tier: user.subscription_tier,
      subscription_status: user.subscription_status,
      custom_domain: user.custom_domain,
      custom_domain_verified: user.custom_domain_verified,
    },
    quota: {
      max_deployments: maxDeployments,
      current_deployments: deploymentCount,
      remaining: Math.max(0, maxDeployments - deploymentCount),
      expires_in_hours: user.subscription_tier === 'free' ? 72 : null,
    },
  });
  
  // If session was rotated, set new cookie
  if (newSessionId) {
    response.headers.set('Set-Cookie', getSessionCookieConfig(newSessionId));
  }
  
  return response;
}

/**
 * Logout - clear session
 */
export async function handleAuthLogout(
  request: Request,
  env: Env
): Promise<Response> {
  const sessionToken = getSessionToken(request);
  
  if (sessionToken) {
    await deleteSession(env, sessionToken);
  }
  
  return new Response(JSON.stringify({ success: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': getSessionDeletionCookie(),
    },
  });
}

// ============================================
// Helper Functions
// ============================================

async function upsertUser(env: Env, googleUser: GoogleUserInfo): Promise<User> {
  const now = Date.now();
  const role = googleUser.email === SUPER_ADMIN_EMAIL ? 'super_admin' : 'user';
  
  // Check if user exists
  const existing = await env.DB.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(googleUser.id).first<User>();
  
  if (existing) {
    // Update existing user
    await env.DB.prepare(`
      UPDATE users SET 
        name = ?, 
        avatar_url = ?, 
        updated_at = ?
      WHERE id = ?
    `).bind(
      googleUser.name,
      googleUser.picture || null,
      now,
      googleUser.id
    ).run();
    
    return { ...existing, name: googleUser.name, avatar_url: googleUser.picture || null, updated_at: now };
  }
  
  // Create new user
  const newUser: User = {
    id: googleUser.id,
    email: googleUser.email,
    name: googleUser.name,
    avatar_url: googleUser.picture || null,
    role,
    subscription_tier: 'free',
    subscription_status: 'active',
    stripe_customer_id: null,
    stripe_subscription_id: null,
    extra_quota_packs: 0,
    custom_domain: null,
    custom_domain_verified: false,
    created_at: now,
    updated_at: now,
  };
  
  await env.DB.prepare(`
    INSERT INTO users (
      id, email, name, avatar_url, role, subscription_tier, subscription_status,
      stripe_customer_id, stripe_subscription_id, extra_quota_packs,
      custom_domain, custom_domain_verified, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    newUser.id,
    newUser.email,
    newUser.name,
    newUser.avatar_url,
    newUser.role,
    newUser.subscription_tier,
    newUser.subscription_status,
    newUser.stripe_customer_id,
    newUser.stripe_subscription_id,
    newUser.extra_quota_packs,
    newUser.custom_domain,
    newUser.custom_domain_verified ? 1 : 0,
    newUser.created_at,
    newUser.updated_at
  ).run();
  
  return newUser;
}


export function getSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const sessionCookie = cookies.find(c => c.startsWith('session='));
  
  if (!sessionCookie) return null;
  return sessionCookie.split('=')[1];
}

export async function getCurrentUser(request: Request, env: Env): Promise<User | null> {
  const sessionToken = getSessionToken(request);
  if (!sessionToken) return null;
  
  const result = await validateSessionAndGetUser(env, sessionToken);
  return result?.user || null;
}

export async function getCurrentUserWithRotation(
  request: Request,
  env: Env
): Promise<{ user: User; newSessionId?: string } | null> {
  const sessionToken = getSessionToken(request);
  if (!sessionToken) return null;
  
  return await validateSessionAndGetUser(env, sessionToken);
}

async function getUserDeploymentCount(env: Env, userId: string): Promise<number> {
  const result = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM deployments WHERE user_id = ?'
  ).bind(userId).first<{ count: number }>();
  
  return result?.count || 0;
}

function getMaxDeployments(user: User): number {
  if (user.subscription_tier === 'free') {
    return 5;
  }
  // Pro: 10 base + 5 per extra pack
  return 10 + (user.extra_quota_packs * 5);
}

function redirectWithError(origin: string, message: string): Response {
  const errorUrl = `${origin}/login?error=${encodeURIComponent(message)}`;
  return Response.redirect(errorUrl, 302);
}

/**
 * Require authentication middleware helper
 */
export async function requireAuth(request: Request, env: Env): Promise<User> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    throw new ApiError(401, 'Authentication required');
  }
  return user;
}

/**
 * Require super admin middleware helper
 */
export async function requireSuperAdmin(request: Request, env: Env): Promise<User> {
  const user = await requireAuth(request, env);
  if (user.role !== 'super_admin') {
    throw new ApiError(403, 'Super admin access required');
  }
  return user;
}
