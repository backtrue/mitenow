/**
 * API Client with Error Handling and Retry Logic
 */

// ============================================
// Types
// ============================================

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

interface RequestConfig extends RequestInit {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
}

// ============================================
// Constants
// ============================================

const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;
const DEFAULT_TIMEOUT = 30000;

const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

// ============================================
// API Client Class
// ============================================

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Make an API request with retry logic
   */
  async request<T>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const {
      retries = DEFAULT_RETRIES,
      retryDelay = DEFAULT_RETRY_DELAY,
      timeout = DEFAULT_TIMEOUT,
      ...fetchConfig
    } = config;

    const url = `${this.baseUrl}${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...fetchConfig,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...fetchConfig.headers,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle successful response
        if (response.ok) {
          // Handle empty responses
          const text = await response.text();
          if (!text) {
            return { data: {} as T };
          }

          try {
            const data = JSON.parse(text);
            return { data };
          } catch {
            return { data: text as unknown as T };
          }
        }

        // Handle non-retryable errors
        if (!RETRYABLE_STATUS_CODES.includes(response.status)) {
          const errorData = await response.json().catch(() => ({}));
          return {
            error: {
              code: errorData.error?.code || `HTTP_${response.status}`,
              message: errorData.error?.message || response.statusText,
              details: errorData.error?.details,
            },
          };
        }

        // Retryable error
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);

      } catch (error) {
        if (error instanceof Error) {
          // Handle abort (timeout)
          if (error.name === 'AbortError') {
            lastError = new Error('Request timeout');
          } else {
            lastError = error;
          }
        }
      }

      // Wait before retry (except for last attempt)
      if (attempt < retries) {
        await this.delay(retryDelay * Math.pow(2, attempt)); // Exponential backoff
      }
    }

    // All retries exhausted
    return {
      error: {
        code: 'NETWORK_ERROR',
        message: lastError?.message || 'Network request failed after retries',
      },
    };
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'GET',
    });
  }

  /**
   * POST request
   */
  async post<T>(
    endpoint: string,
    body?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T>(
    endpoint: string,
    body?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'DELETE',
    });
  }

  /**
   * Upload file with progress tracking
   */
  async upload(
    endpoint: string,
    file: File | Blob,
    onProgress?: (progress: number) => void
  ): Promise<ApiResponse<unknown>> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve({ data });
          } catch {
            resolve({ data: xhr.responseText });
          }
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText);
            resolve({
              error: {
                code: errorData.error?.code || `HTTP_${xhr.status}`,
                message: errorData.error?.message || xhr.statusText,
              },
            });
          } catch {
            resolve({
              error: {
                code: `HTTP_${xhr.status}`,
                message: xhr.statusText,
              },
            });
          }
        }
      });

      xhr.addEventListener('error', () => {
        resolve({
          error: {
            code: 'NETWORK_ERROR',
            message: 'Upload failed',
          },
        });
      });

      xhr.addEventListener('abort', () => {
        resolve({
          error: {
            code: 'ABORTED',
            message: 'Upload aborted',
          },
        });
      });

      xhr.open('POST', `${this.baseUrl}${endpoint}`);
      xhr.withCredentials = true;
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.send(file);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================
// Singleton Instance
// ============================================

// Singleton instance is defined below with domain-specific methods

// ============================================
// Helper Functions
// ============================================

/**
 * Check if an API response has an error
 */
export function isApiError<T>(response: ApiResponse<T>): response is { error: ApiError } {
  return !!response.error;
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: ApiError): string {
  const messages: Record<string, string> = {
    UNAUTHORIZED: 'Please log in to continue',
    FORBIDDEN: 'You do not have permission to perform this action',
    NOT_FOUND: 'The requested resource was not found',
    RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later',
    NETWORK_ERROR: 'Network error. Please check your connection',
    TIMEOUT: 'Request timed out. Please try again',
  };

  return messages[error.code] || error.message;
}

// ============================================
// Domain-Specific Types
// ============================================

export interface SubdomainCheckResponse {
  available: boolean;
  message: string;
  canRelease?: boolean;
  existingDeploymentId?: string;
}

export interface StatusResponse {
  status: 'pending' | 'uploading' | 'building' | 'deploying' | 'active' | 'failed';
  cloud_run_url?: string;
  error?: string;
  created_at: number;
  updated_at: number;
}

export interface DeployCodeResponse {
  app_id: string;
  subdomain: string;
  status: string;
  message: string;
  ai_detection: {
    isAIGenerated: boolean;
    confidence: number;
    source: 'chatgpt' | 'gemini' | 'copilot' | 'unknown';
  };
  framework_detection: {
    framework: string;
    confidence: number;
  };
}

// ============================================
// Domain-Specific API Methods
// ============================================

export const api = {
  /**
   * Check subdomain availability
   */
  async checkSubdomain(subdomain: string): Promise<SubdomainCheckResponse> {
    const response = await fetch(`/api/v1/subdomain/check/${encodeURIComponent(subdomain)}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to check subdomain');
    }

    return response.json();
  },

  /**
   * Release a subdomain (for user's own expired/failed deployments)
   */
  async releaseSubdomain(subdomain: string): Promise<void> {
    const response = await fetch(`/api/v1/subdomain/release/${encodeURIComponent(subdomain)}`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || data.message || '無法釋放子網域');
    }
  },

  /**
   * Get deployment status
   */
  async getStatus(appId: string): Promise<StatusResponse> {
    const response = await fetch(`/api/v1/status/${appId}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to get status');
    }

    return response.json();
  },

  /**
   * Prepare a file for upload
   */
  async prepare(filename: string): Promise<{ app_id: string; upload_url: string }> {
    const response = await fetch('/api/v1/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ filename }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Failed to prepare upload');
    }

    return response.json();
  },

  /**
   * Upload a file to the given URL
   */
  async upload(uploadUrl: string, file: File): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/zip' },
      body: file,
    });

    if (!response.ok) {
      throw new Error('Failed to upload file');
    }
  },

  /**
   * Deploy an application
   */
  async deploy(params: {
    app_id: string;
    subdomain: string;
    api_key: string;
    framework: string;
  }): Promise<{ deployment_id: string }> {
    const response = await fetch('/api/v1/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Failed to deploy');
    }

    return response.json();
  },

  /**
   * Deploy code directly (without ZIP upload)
   */
  async deployCode(params: {
    code: string;
    subdomain: string;
    api_key: string;
    framework?: string;
    filename?: string;
  }): Promise<DeployCodeResponse> {
    const response = await fetch('/api/v1/deploy-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Failed to deploy code');
    }

    return response.json();
  },

  /**
   * Get security scan results for an app
   */
  async getSecurityResults(appId: string): Promise<SecurityScanResult> {
    const response = await fetch(`/api/v1/security/${appId}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to get security results');
    }

    return response.json();
  },
};

// ============================================
// Security Scan Types
// ============================================

export interface SecurityCheck {
  id: string;
  name: string;
  passed: boolean;
  severity: 'critical' | 'warning';
  message: string;
  findings: string[];
}

export interface SecurityScanResult {
  passed: boolean;
  hasWarnings: boolean;
  checks: SecurityCheck[];
}

