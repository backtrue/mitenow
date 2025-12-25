'use client';

import { Component, ReactNode } from 'react';

// ============================================
// Types
// ============================================

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

// ============================================
// Error Boundary Component
// ============================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log error to console
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);

        // Call custom error handler if provided
        this.props.onError?.(error, errorInfo);

        // Report to Sentry if available
        // Note: @sentry/nextjs doesn't support Next.js 16 yet
        if (typeof window !== 'undefined') {
            console.error('[ErrorBoundary] Error captured:', error.message);
        }
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError && this.state.error) {
            // Use custom fallback if provided
            if (this.props.fallback) {
                if (typeof this.props.fallback === 'function') {
                    return this.props.fallback(this.state.error, this.handleReset);
                }
                return this.props.fallback;
            }

            // Default fallback UI
            return (
                <DefaultErrorFallback
                    error={this.state.error}
                    reset={this.handleReset}
                />
            );
        }

        return this.props.children;
    }
}

// ============================================
// Default Error Fallback UI
// ============================================

interface DefaultErrorFallbackProps {
    error: Error;
    reset: () => void;
}

function DefaultErrorFallback({ error, reset }: DefaultErrorFallbackProps) {
    return (
        <div className="min-h-[200px] flex flex-col items-center justify-center p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <div className="text-red-600 dark:text-red-400 mb-4">
                <svg
                    className="w-12 h-12"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                </svg>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                發生錯誤
            </h3>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 text-center max-w-md">
                {error.message || '發生了意外錯誤'}
            </p>

            <button
                onClick={reset}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
                重試
            </button>
        </div>
    );
}

// ============================================
// HOC for wrapping components
// ============================================

export function withErrorBoundary<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    fallback?: ErrorBoundaryProps['fallback']
) {
    return function WithErrorBoundaryWrapper(props: P) {
        return (
            <ErrorBoundary fallback={fallback}>
                <WrappedComponent {...props} />
            </ErrorBoundary>
        );
    };
}

// ============================================
// Async Error Boundary (for use with Suspense)
// ============================================

interface AsyncBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    errorFallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export function AsyncBoundary({
    children,
    fallback,
    errorFallback,
    onError,
}: AsyncBoundaryProps) {
    return (
        <ErrorBoundary fallback={errorFallback} onError={onError}>
            {fallback ? (
                <>{children}</>
            ) : (
                children
            )}
        </ErrorBoundary>
    );
}
