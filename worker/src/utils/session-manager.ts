/**
 * Session Management Utilities
 * Implements session rotation and security best practices
 */

import type { Env, User } from '../types';

const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_ROTATION_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_ABSOLUTE_TIMEOUT = 90 * 24 * 60 * 60 * 1000; // 90 days

export interface Session {
  id: string;
  user_id: string;
  expires_at: number;
  created_at: number;
  last_rotated_at: number;
  rotation_count: number;
}

/**
 * Create a new session
 */
export async function createSession(
  env: Env,
  userId: string
): Promise<string> {
  const sessionId = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + SESSION_DURATION;
  
  await env.DB.prepare(`
    INSERT INTO sessions (id, user_id, expires_at, created_at, last_rotated_at, rotation_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(sessionId, userId, expiresAt, now, now, 0).run();
  
  return sessionId;
}

/**
 * Get session by ID
 */
export async function getSession(
  env: Env,
  sessionId: string
): Promise<Session | null> {
  const result = await env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ?'
  ).bind(sessionId).first<Session>();
  
  return result || null;
}

/**
 * Check if session needs rotation
 */
export function needsRotation(session: Session): boolean {
  const now = Date.now();
  const timeSinceRotation = now - session.last_rotated_at;
  
  // Rotate if:
  // 1. More than 24 hours since last rotation
  // 2. Session is older than 90 days (absolute timeout)
  if (timeSinceRotation > SESSION_ROTATION_INTERVAL) {
    return true;
  }
  
  const sessionAge = now - session.created_at;
  if (sessionAge > SESSION_ABSOLUTE_TIMEOUT) {
    return true;
  }
  
  return false;
}

/**
 * Rotate session - create new session ID and invalidate old one
 */
export async function rotateSession(
  env: Env,
  oldSessionId: string,
  userId: string
): Promise<string> {
  const now = Date.now();
  const oldSession = await getSession(env, oldSessionId);
  
  // Check if session has exceeded absolute timeout
  if (oldSession && (now - oldSession.created_at) > SESSION_ABSOLUTE_TIMEOUT) {
    // Force re-authentication
    await deleteSession(env, oldSessionId);
    throw new Error('SESSION_EXPIRED');
  }
  
  // Create new session ID
  const newSessionId = crypto.randomUUID();
  const expiresAt = now + SESSION_DURATION;
  const rotationCount = oldSession ? oldSession.rotation_count + 1 : 0;
  const createdAt = oldSession ? oldSession.created_at : now;
  
  // Insert new session
  await env.DB.prepare(`
    INSERT INTO sessions (id, user_id, expires_at, created_at, last_rotated_at, rotation_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(newSessionId, userId, expiresAt, createdAt, now, rotationCount).run();
  
  // Delete old session
  await deleteSession(env, oldSessionId);
  
  return newSessionId;
}

/**
 * Delete session
 */
export async function deleteSession(
  env: Env,
  sessionId: string
): Promise<void> {
  await env.DB.prepare('DELETE FROM sessions WHERE id = ?')
    .bind(sessionId)
    .run();
}

/**
 * Delete all sessions for a user
 */
export async function deleteAllUserSessions(
  env: Env,
  userId: string
): Promise<void> {
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?')
    .bind(userId)
    .run();
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(env: Env): Promise<number> {
  const now = Date.now();
  
  const result = await env.DB.prepare(
    'DELETE FROM sessions WHERE expires_at < ?'
  ).bind(now).run();
  
  return result.meta.changes || 0;
}

/**
 * Get session cookie configuration
 */
export function getSessionCookieConfig(sessionId: string): string {
  const maxAge = SESSION_DURATION / 1000; // Convert to seconds
  return `session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

/**
 * Get session deletion cookie
 */
export function getSessionDeletionCookie(): string {
  return 'session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

/**
 * Validate session and get user
 * Automatically rotates session if needed
 */
export async function validateSessionAndGetUser(
  env: Env,
  sessionId: string
): Promise<{ user: User; newSessionId?: string } | null> {
  const now = Date.now();
  
  // Get session and user in one query
  const result = await env.DB.prepare(`
    SELECT 
      u.*,
      s.id as session_id,
      s.expires_at,
      s.created_at as session_created_at,
      s.last_rotated_at,
      s.rotation_count
    FROM users u
    INNER JOIN sessions s ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > ?
  `).bind(sessionId, now).first<User & {
    session_id: string;
    expires_at: number;
    session_created_at: number;
    last_rotated_at: number;
    rotation_count: number;
  }>();
  
  if (!result) {
    return null;
  }
  
  // Extract session data
  const session: Session = {
    id: result.session_id,
    user_id: result.id,
    expires_at: result.expires_at,
    created_at: result.session_created_at,
    last_rotated_at: result.last_rotated_at,
    rotation_count: result.rotation_count,
  };
  
  // Extract user data
  const user: User = {
    id: result.id,
    email: result.email,
    name: result.name,
    avatar_url: result.avatar_url,
    role: result.role,
    subscription_tier: result.subscription_tier,
    subscription_status: result.subscription_status,
    stripe_customer_id: result.stripe_customer_id,
    stripe_subscription_id: result.stripe_subscription_id,
    extra_quota_packs: result.extra_quota_packs,
    custom_domain: result.custom_domain,
    custom_domain_verified: Boolean(result.custom_domain_verified),
    created_at: result.created_at,
    updated_at: result.updated_at,
  };
  
  // Check if session needs rotation
  if (needsRotation(session)) {
    try {
      const newSessionId = await rotateSession(env, sessionId, user.id);
      return { user, newSessionId };
    } catch (error) {
      if (error instanceof Error && error.message === 'SESSION_EXPIRED') {
        return null;
      }
      throw error;
    }
  }
  
  return { user };
}

/**
 * Update session activity timestamp
 */
export async function updateSessionActivity(
  env: Env,
  sessionId: string
): Promise<void> {
  const now = Date.now();
  const newExpiresAt = now + SESSION_DURATION;
  
  await env.DB.prepare(`
    UPDATE sessions 
    SET expires_at = ?
    WHERE id = ?
  `).bind(newExpiresAt, sessionId).run();
}
