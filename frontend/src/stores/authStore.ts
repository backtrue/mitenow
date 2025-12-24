/**
 * Authentication Store
 * Manages user authentication state using Zustand
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ============================================
// Types
// ============================================

export interface User {
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
    role: 'user' | 'super_admin';
    subscription_tier: 'free' | 'pro';
    subscription_status: 'active' | 'canceled' | 'past_due';
}

export interface Quota {
    max_deployments: number;
    current_deployments: number;
    remaining: number;
    expires_in_hours: number | null;
}

interface AuthState {
    // State
    user: User | null;
    quota: Quota | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    error: string | null;

    // Actions
    login: () => void;
    logout: () => Promise<void>;
    fetchUser: () => Promise<void>;
    clearError: () => void;
    setUser: (user: User | null) => void;
    setQuota: (quota: Quota | null) => void;
}

// ============================================
// API Base URL
// ============================================

const API_BASE = typeof window !== 'undefined'
    ? '' // Use relative URLs in browser
    : process.env.NEXT_PUBLIC_API_URL || '';

// ============================================
// Store
// ============================================

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            // Initial state
            user: null,
            quota: null,
            isLoading: true,
            isAuthenticated: false,
            error: null,

            // Login action
            login: () => {
                if (typeof window !== 'undefined') {
                    window.location.href = `${API_BASE}/api/v1/auth/login`;
                }
            },

            // Logout action
            logout: async () => {
                try {
                    await fetch(`${API_BASE}/api/v1/auth/logout`, {
                        method: 'POST',
                        credentials: 'include',
                    });
                } catch {
                    // Ignore errors on logout
                }

                set({
                    user: null,
                    quota: null,
                    isAuthenticated: false,
                    error: null,
                });
            },

            // Fetch user action
            fetchUser: async () => {
                set({ isLoading: true, error: null });

                try {
                    const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
                        credentials: 'include',
                    });

                    if (!response.ok) {
                        if (response.status === 401) {
                            set({
                                user: null,
                                quota: null,
                                isAuthenticated: false,
                                isLoading: false,
                            });
                            return;
                        }
                        throw new Error('Failed to fetch user');
                    }

                    const data = await response.json();

                    set({
                        user: data.user,
                        quota: data.quota || null,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (error) {
                    set({
                        user: null,
                        quota: null,
                        isAuthenticated: false,
                        isLoading: false,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            },

            // Clear error
            clearError: () => {
                set({ error: null });
            },

            // Set user directly (for optimistic updates)
            setUser: (user) => {
                set({ user, isAuthenticated: !!user });
            },

            // Set quota directly
            setQuota: (quota) => {
                set({ quota });
            },
        }),
        {
            name: 'mite-auth-storage',
            storage: createJSONStorage(() =>
                typeof window !== 'undefined' ? sessionStorage : {
                    getItem: () => null,
                    setItem: () => { },
                    removeItem: () => { },
                }
            ),
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);

// ============================================
// Hooks
// ============================================

/**
 * Hook to initialize auth state on app load
 */
export function useAuthInit() {
    const fetchUser = useAuthStore((state) => state.fetchUser);
    const isLoading = useAuthStore((state) => state.isLoading);

    // This should be called in a useEffect in the root layout
    return { fetchUser, isLoading };
}

/**
 * Hook for protected routes
 */
export function useRequireAuth() {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const isLoading = useAuthStore((state) => state.isLoading);
    const login = useAuthStore((state) => state.login);

    return {
        isAuthenticated,
        isLoading,
        redirectToLogin: login,
    };
}

/**
 * Hook for admin routes
 */
export function useRequireAdmin() {
    const user = useAuthStore((state) => state.user);
    const isLoading = useAuthStore((state) => state.isLoading);

    return {
        isAdmin: user?.role === 'super_admin',
        isLoading,
    };
}
