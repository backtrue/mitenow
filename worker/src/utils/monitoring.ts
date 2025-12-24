/**
 * Monitoring & Error Tracking Utility
 * Integrates Sentry for error tracking and performance monitoring
 */

import type { Env } from '../types';

// ============================================
// Types
// ============================================

interface MonitoringEvent {
    name: string;
    data?: Record<string, unknown>;
    level?: 'info' | 'warning' | 'error';
}

interface PerformanceSpan {
    name: string;
    startTime: number;
    endTime?: number;
    data?: Record<string, unknown>;
}

interface ErrorContext {
    userId?: string;
    appId?: string;
    subdomain?: string;
    endpoint?: string;
    method?: string;
    [key: string]: unknown;
}

// ============================================
// Sentry Integration (Lightweight for Workers)
// ============================================

// Sentry DSN will be set via environment variable
let sentryDsn: string | null = null;
let environment: string = 'production';

/**
 * Initialize monitoring with Sentry DSN
 */
export function initMonitoring(env: Env): void {
    sentryDsn = env.SENTRY_DSN || null;
    environment = env.ENVIRONMENT || 'production';

    if (!sentryDsn) {
        console.warn('[Monitoring] Sentry DSN not configured, error tracking disabled');
    }
}

/**
 * Capture an error and send to Sentry
 */
export async function captureError(
    error: Error | unknown,
    context?: ErrorContext
): Promise<void> {
    const errorObj = error instanceof Error ? error : new Error(String(error));

    // Always log to console
    console.error('[Error]', errorObj.message, context);

    // Send to Sentry if configured
    if (sentryDsn) {
        try {
            await sendToSentry({
                type: 'error',
                message: errorObj.message,
                stack: errorObj.stack,
                context,
                timestamp: new Date().toISOString(),
            });
        } catch (sentryError) {
            console.error('[Monitoring] Failed to send to Sentry:', sentryError);
        }
    }
}

/**
 * Capture a custom event
 */
export async function captureEvent(event: MonitoringEvent): Promise<void> {
    console.log(`[Event:${event.level || 'info'}]`, event.name, event.data);

    if (sentryDsn) {
        try {
            await sendToSentry({
                type: 'event',
                name: event.name,
                level: event.level || 'info',
                data: event.data,
                timestamp: new Date().toISOString(),
            });
        } catch (sentryError) {
            console.error('[Monitoring] Failed to send event to Sentry:', sentryError);
        }
    }
}

/**
 * Track API request performance
 */
export function createRequestTracker(
    request: Request,
    env: Env
): RequestTracker {
    return new RequestTracker(request, env);
}

export class RequestTracker {
    private startTime: number;
    private spans: PerformanceSpan[] = [];
    private request: Request;

    constructor(request: Request, env: Env) {
        this.startTime = Date.now();
        this.request = request;
        initMonitoring(env);
    }

    /**
     * Start a new span for tracking a sub-operation
     */
    startSpan(name: string, data?: Record<string, unknown>): () => void {
        const span: PerformanceSpan = {
            name,
            startTime: Date.now(),
            data,
        };
        this.spans.push(span);

        // Return a function to end the span
        return () => {
            span.endTime = Date.now();
        };
    }

    /**
     * Finish tracking and report metrics
     */
    async finish(
        response: Response,
        error?: Error
    ): Promise<void> {
        const duration = Date.now() - this.startTime;
        const url = new URL(this.request.url);

        const metrics = {
            endpoint: url.pathname,
            method: this.request.method,
            status: response.status,
            duration,
            spans: this.spans.map(s => ({
                name: s.name,
                duration: s.endTime ? s.endTime - s.startTime : null,
                data: s.data,
            })),
            error: error?.message,
        };

        // Log performance data
        console.log('[Performance]', JSON.stringify(metrics));

        // Report slow requests
        if (duration > 5000) {
            await captureEvent({
                name: 'slow_request',
                level: 'warning',
                data: metrics,
            });
        }

        // Report errors
        if (error) {
            await captureError(error, {
                endpoint: url.pathname,
                method: this.request.method,
            });
        }
    }
}

// ============================================
// Business Event Tracking
// ============================================

/**
 * Track deployment events
 */
export async function trackDeployment(
    appId: string,
    subdomain: string,
    status: 'started' | 'success' | 'failed',
    framework?: string,
    error?: string
): Promise<void> {
    await captureEvent({
        name: `deployment.${status}`,
        level: status === 'failed' ? 'error' : 'info',
        data: {
            appId,
            subdomain,
            framework,
            error,
        },
    });
}

/**
 * Track authentication events
 */
export async function trackAuth(
    event: 'login' | 'logout' | 'signup' | 'login_failed',
    userId?: string,
    email?: string
): Promise<void> {
    await captureEvent({
        name: `auth.${event}`,
        level: event === 'login_failed' ? 'warning' : 'info',
        data: {
            userId,
            email: email ? `${email.split('@')[0]}@***` : undefined, // Mask email
        },
    });
}

/**
 * Track quota events
 */
export async function trackQuota(
    userId: string,
    event: 'exceeded' | 'warning' | 'upgraded',
    current: number,
    max: number
): Promise<void> {
    await captureEvent({
        name: `quota.${event}`,
        level: event === 'exceeded' ? 'warning' : 'info',
        data: {
            userId,
            current,
            max,
            usage: `${Math.round((current / max) * 100)}%`,
        },
    });
}

/**
 * Track rate limit events
 */
export async function trackRateLimit(
    ip: string,
    endpoint: string,
    userId?: string
): Promise<void> {
    await captureEvent({
        name: 'rate_limit.hit',
        level: 'warning',
        data: {
            ip: ip.split('.').slice(0, 2).join('.') + '.*.*', // Mask IP
            endpoint,
            userId,
        },
    });
}

// ============================================
// Sentry API (Lightweight Implementation)
// ============================================

interface SentryPayload {
    type: 'error' | 'event';
    message?: string;
    stack?: string;
    name?: string;
    level?: string;
    context?: Record<string, unknown>;
    data?: Record<string, unknown>;
    timestamp: string;
}

async function sendToSentry(payload: SentryPayload): Promise<void> {
    if (!sentryDsn) return;

    // Parse Sentry DSN
    // Format: https://<key>@<org>.ingest.sentry.io/<project>
    const dsnMatch = sentryDsn.match(/https:\/\/([^@]+)@([^/]+)\/(\d+)/);
    if (!dsnMatch) {
        console.error('[Monitoring] Invalid Sentry DSN format');
        return;
    }

    const [, publicKey, host, projectId] = dsnMatch;
    const sentryUrl = `https://${host}/api/${projectId}/envelope/`;

    // Build Sentry envelope
    const envelope = buildSentryEnvelope(payload, publicKey, projectId);

    try {
        const response = await fetch(sentryUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-sentry-envelope',
                'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=mite-worker/1.0.0, sentry_key=${publicKey}`,
            },
            body: envelope,
        });

        if (!response.ok) {
            console.error('[Monitoring] Sentry API error:', response.status);
        }
    } catch (error) {
        console.error('[Monitoring] Failed to reach Sentry:', error);
    }
}

function buildSentryEnvelope(
    payload: SentryPayload,
    _publicKey: string,
    _projectId: string
): string {
    const eventId = crypto.randomUUID().replace(/-/g, '');

    // Envelope header
    const envelopeHeader = JSON.stringify({
        event_id: eventId,
        sent_at: payload.timestamp,
        dsn: sentryDsn,
    });

    // Item header
    const itemHeader = JSON.stringify({
        type: payload.type === 'error' ? 'event' : 'event',
    });

    // Event payload
    const eventPayload = JSON.stringify({
        event_id: eventId,
        timestamp: payload.timestamp,
        platform: 'javascript',
        environment,
        level: payload.level || (payload.type === 'error' ? 'error' : 'info'),
        message: payload.message || payload.name,
        exception: payload.stack ? {
            values: [{
                type: 'Error',
                value: payload.message,
                stacktrace: {
                    frames: parseStackTrace(payload.stack),
                },
            }],
        } : undefined,
        extra: {
            ...payload.context,
            ...payload.data,
        },
        tags: {
            service: 'mite-worker',
            environment,
        },
    });

    return `${envelopeHeader}\n${itemHeader}\n${eventPayload}`;
}

function parseStackTrace(stack: string): Array<{ filename: string; lineno: number; colno: number; function: string }> {
    const lines = stack.split('\n').slice(1); // Skip the error message line
    return lines.map(line => {
        const match = line.match(/at\s+(\S+)\s+\((.+):(\d+):(\d+)\)/);
        if (match) {
            return {
                function: match[1],
                filename: match[2],
                lineno: parseInt(match[3], 10),
                colno: parseInt(match[4], 10),
            };
        }
        return {
            function: '<anonymous>',
            filename: 'unknown',
            lineno: 0,
            colno: 0,
        };
    }).filter(frame => frame.filename !== 'unknown');
}

// ============================================
// Health Check Metrics
// ============================================

interface HealthMetrics {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    checks: {
        kv: boolean;
        r2: boolean;
        d1: boolean;
    };
    timestamp: string;
}

/**
 * Perform health check and return metrics
 */
export async function getHealthMetrics(env: Env): Promise<HealthMetrics> {
    const checks = {
        kv: false,
        r2: false,
        d1: false,
    };

    // Check KV
    try {
        await env.MITE_KV.get('health-check');
        checks.kv = true;
    } catch {
        checks.kv = false;
    }

    // Check R2
    try {
        await env.MITE_BUCKET.head('health-check');
        checks.r2 = true;
    } catch {
        // R2 returns 404 for non-existent objects, which is fine
        checks.r2 = true;
    }

    // Check D1
    try {
        await env.DB.prepare('SELECT 1').first();
        checks.d1 = true;
    } catch {
        checks.d1 = false;
    }

    const allHealthy = Object.values(checks).every(v => v);
    const anyHealthy = Object.values(checks).some(v => v);

    return {
        status: allHealthy ? 'healthy' : anyHealthy ? 'degraded' : 'unhealthy',
        uptime: Date.now(), // Placeholder - Workers don't have persistent uptime
        checks,
        timestamp: new Date().toISOString(),
    };
}
