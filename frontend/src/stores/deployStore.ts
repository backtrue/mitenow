/**
 * Deployment Store
 * Manages deployment state and operations using Zustand
 */

import { create } from 'zustand';

// ============================================
// Types
// ============================================

export type DeploymentStatus =
    | 'pending'
    | 'uploading'
    | 'analyzing'
    | 'building'
    | 'deploying'
    | 'active'
    | 'failed'
    | 'expired';

export interface Deployment {
    id: string;
    subdomain: string;
    framework: string | null;
    status: DeploymentStatus;
    cloud_run_url: string | null;
    custom_domain: string | null;
    created_at: number;
    updated_at: number;
    expires_at: number | null;
}

interface DeployState {
    // State
    deployments: Deployment[];
    currentDeployment: Deployment | null;
    isLoading: boolean;
    error: string | null;

    // Upload state
    uploadProgress: number;
    isUploading: boolean;

    // Actions
    fetchDeployments: () => Promise<void>;
    fetchDeployment: (id: string) => Promise<Deployment | null>;
    deleteDeployment: (id: string) => Promise<boolean>;
    setCurrentDeployment: (deployment: Deployment | null) => void;
    setUploadProgress: (progress: number) => void;
    setIsUploading: (isUploading: boolean) => void;
    clearError: () => void;
    reset: () => void;
}

// ============================================
// API Base URL
// ============================================

const API_BASE = typeof window !== 'undefined'
    ? ''
    : process.env.NEXT_PUBLIC_API_URL || '';

// ============================================
// Store
// ============================================

export const useDeployStore = create<DeployState>()((set, get) => ({
    // Initial state
    deployments: [],
    currentDeployment: null,
    isLoading: false,
    error: null,
    uploadProgress: 0,
    isUploading: false,

    // Fetch all deployments
    fetchDeployments: async () => {
        set({ isLoading: true, error: null });

        try {
            const response = await fetch(`${API_BASE}/api/v1/deployments`, {
                credentials: 'include',
            });

            if (!response.ok) {
                if (response.status === 401) {
                    set({ deployments: [], isLoading: false });
                    return;
                }
                throw new Error('Failed to fetch deployments');
            }

            const data = await response.json();

            set({
                deployments: data.deployments || [],
                isLoading: false,
            });
        } catch (error) {
            set({
                isLoading: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    },

    // Fetch single deployment
    fetchDeployment: async (id: string) => {
        set({ isLoading: true, error: null });

        try {
            const response = await fetch(`${API_BASE}/api/v1/deployments/${id}`, {
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Deployment not found');
            }

            const deployment = await response.json();

            set({
                currentDeployment: deployment,
                isLoading: false,
            });

            return deployment;
        } catch (error) {
            set({
                isLoading: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return null;
        }
    },

    // Delete deployment
    deleteDeployment: async (id: string) => {
        try {
            const response = await fetch(`${API_BASE}/api/v1/deployments/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Failed to delete deployment');
            }

            // Remove from local state
            const deployments = get().deployments.filter(d => d.id !== id);
            set({ deployments });

            return true;
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    },

    // Set current deployment
    setCurrentDeployment: (deployment) => {
        set({ currentDeployment: deployment });
    },

    // Set upload progress
    setUploadProgress: (progress) => {
        set({ uploadProgress: progress });
    },

    // Set uploading state
    setIsUploading: (isUploading) => {
        set({ isUploading, uploadProgress: isUploading ? 0 : get().uploadProgress });
    },

    // Clear error
    clearError: () => {
        set({ error: null });
    },

    // Reset state
    reset: () => {
        set({
            deployments: [],
            currentDeployment: null,
            isLoading: false,
            error: null,
            uploadProgress: 0,
            isUploading: false,
        });
    },
}));

// ============================================
// Hooks
// ============================================

/**
 * Hook to get deployment status color
 */
export function getStatusColor(status: DeploymentStatus): string {
    switch (status) {
        case 'active':
            return 'text-green-500';
        case 'building':
        case 'deploying':
        case 'analyzing':
        case 'uploading':
            return 'text-yellow-500';
        case 'failed':
        case 'expired':
            return 'text-red-500';
        default:
            return 'text-gray-500';
    }
}

/**
 * Hook to get deployment status label
 */
export function getStatusLabel(status: DeploymentStatus): string {
    const labels: Record<DeploymentStatus, string> = {
        pending: 'Pending',
        uploading: 'Uploading',
        analyzing: 'Analyzing',
        building: 'Building',
        deploying: 'Deploying',
        active: 'Active',
        failed: 'Failed',
        expired: 'Expired',
    };
    return labels[status] || status;
}
