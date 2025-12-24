'use client';

import { useEffect } from 'react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log error to console (Sentry SDK not available for Next.js 16 yet)
        console.error('[GlobalError] Caught error:', error);
    }, [error]);

    return (
        <html>
            <body>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    padding: '20px',
                    textAlign: 'center',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    backgroundColor: '#0a0a0a',
                    color: '#ffffff',
                }}>
                    <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
                        Something went wrong!
                    </h1>
                    <p style={{
                        color: '#888',
                        marginBottom: '2rem',
                        maxWidth: '500px',
                    }}>
                        We apologize for the inconvenience. Our team has been notified and is working on a fix.
                    </p>
                    <button
                        onClick={() => reset()}
                        style={{
                            padding: '12px 24px',
                            fontSize: '1rem',
                            fontWeight: 600,
                            color: '#000',
                            backgroundColor: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'opacity 0.2s',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'}
                        onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                    >
                        Try Again
                    </button>
                    {error.digest && (
                        <p style={{
                            marginTop: '2rem',
                            fontSize: '0.75rem',
                            color: '#666',
                        }}>
                            Error ID: {error.digest}
                        </p>
                    )}
                </div>
            </body>
        </html>
    );
}
