// Sentry Client-Side Configuration for Next.js
// NOTE: @sentry/nextjs currently doesn't support Next.js 16
// This is a placeholder that will be enabled once support is available

// For now, we use a simple console-based error tracking
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN && typeof window !== 'undefined') {
    console.log('[Sentry] DSN configured but SDK not loaded (Next.js 16 not yet supported)');
}

// Export empty object for compatibility
export default {};
