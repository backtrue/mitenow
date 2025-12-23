const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.mite.now';

export interface PrepareResponse {
  app_id: string;
  upload_url: string;
  expires_at: string;
}

export interface DeployRequest {
  app_id: string;
  subdomain: string;
  api_key: string;
  framework?: 'streamlit' | 'gradio' | 'flask' | 'auto';
}

export interface DeployResponse {
  app_id: string;
  subdomain: string;
  status: string;
  message: string;
}

export interface StatusResponse {
  app_id: string;
  subdomain: string;
  status: 'pending' | 'uploading' | 'building' | 'deploying' | 'active' | 'failed';
  url?: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface SubdomainCheckResponse {
  subdomain: string;
  available: boolean;
  reason?: 'reserved' | 'in_use' | 'stale_failed' | 'invalid_format';
  canRelease?: boolean;
  message: string;
}

class MiteApi {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  async prepare(filename: string): Promise<PrepareResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/prepare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filename }),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.error?.message || 'Failed to prepare upload');
    }

    return response.json();
  }

  async upload(uploadUrl: string, file: File): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/zip',
      },
      body: file,
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.error?.message || 'Failed to upload file');
    }
  }

  async deploy(request: DeployRequest): Promise<DeployResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.error?.message || 'Failed to deploy');
    }

    return response.json();
  }

  async getStatus(appId: string): Promise<StatusResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/status/${appId}`);

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.error?.message || 'Failed to get status');
    }

    return response.json();
  }

  async checkSubdomain(subdomain: string): Promise<SubdomainCheckResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/subdomain/check/${subdomain}`);

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.error?.message || 'Failed to check subdomain');
    }

    return response.json();
  }

  async releaseSubdomain(subdomain: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/api/v1/subdomain/release/${subdomain}`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.error?.message || 'Failed to release subdomain');
    }

    return response.json();
  }
}

export const api = new MiteApi();
