/**
 * mite.now - Type Definitions
 */

// ============================================
// Environment Bindings
// ============================================
export interface Env {
  // Cloudflare R2 Bucket
  MITE_BUCKET: R2Bucket;

  // Cloudflare KV Namespace
  MITE_KV: KVNamespace;

  // Cloudflare D1 Database
  DB: D1Database;

  // Static Assets (for main site)
  ASSETS: Fetcher;

  // GCP Configuration
  GCP_PROJECT_ID: string;
  GCP_SERVICE_ACCOUNT_KEY: string; // Base64 encoded JSON key
  GCP_REGION: string;

  // Security
  API_SECRET_KEY: string; // For signing internal tokens
  ALLOWED_ORIGINS: string; // Comma-separated origins

  // Admin
  ADMIN_TOKEN: string; // Token for admin API access

  // Google OAuth
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;

  // Stripe
  STRIPE_SECRET_KEY: string;
  STRIPE_PUBLISHABLE_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_ID_PRO: string;
  STRIPE_PRICE_ID_QUOTA: string;

  // Environment
  ENVIRONMENT?: string; // 'production' | 'development'

  // Monitoring
  SENTRY_DSN?: string; // Sentry error tracking DSN
}

// ============================================
// API Request/Response Types
// ============================================
export interface PrepareRequest {
  filename: string;
}

export interface PrepareResponse {
  app_id: string;
  upload_url: string;
  expires_at: string;
}

export interface DeployRequest {
  app_id: string;
  api_key: string; // User's Gemini API Key
  subdomain: string;
  framework?: FrameworkType; // Optional framework override
}

export interface DeployResponse {
  app_id: string;
  subdomain: string;
  status: DeploymentStatus;
  message: string;
}

export interface StatusResponse {
  app_id: string;
  subdomain: string;
  status: DeploymentStatus;
  target_url?: string;
  error?: string;
  created_at: string;
  updated_at: string;
  build_id?: string;
}

// ============================================
// Deployment State
// ============================================
export type DeploymentStatus =
  | 'pending'      // ZIP uploaded, waiting for deploy trigger
  | 'uploading'    // Transferring to GCS
  | 'analyzing'    // Analyzing ZIP contents
  | 'building'     // Cloud Build in progress
  | 'deploying'    // Deploying to Cloud Run
  | 'active'       // Successfully deployed
  | 'failed'       // Deployment failed
  | 'expired';     // TTL exceeded

export interface AppRecord {
  app_id: string;
  subdomain: string;
  status: DeploymentStatus;
  target_url?: string;
  framework?: FrameworkType;
  build_id?: string;
  error?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  user_id?: string; // Owner of the deployment
}

// ============================================
// Framework Detection
// ============================================
export type FrameworkType =
  | 'streamlit'  // Python - Streamlit apps
  | 'gradio'     // Python - Gradio ML interfaces
  | 'flask'      // Python - Flask web apps
  | 'fastapi'    // Python - FastAPI apps
  | 'react'      // Node.js - React/Vite SPA
  | 'nextjs'     // Node.js - Next.js SSR
  | 'express'    // Node.js - Express API
  | 'static'     // Pure HTML/CSS/JS
  | 'unknown';

export interface ZipAnalysisResult {
  framework: FrameworkType;
  entrypoint: string;
  has_requirements: boolean;
  has_package_json?: boolean;
  files: string[];
}

// ============================================
// GCP Cloud Build Types
// ============================================
export interface CloudBuildRequest {
  projectId: string;
  build: CloudBuildConfig;
}

export interface CloudBuildConfig {
  source: {
    storageSource: {
      bucket: string;
      object: string;
    };
  };
  steps: BuildStep[];
  images: string[];
  options?: BuildOptions;
  substitutions?: Record<string, string>;
  timeout?: string;
}

export interface BuildStep {
  name: string;
  args?: string[];
  env?: string[];
  dir?: string;
  entrypoint?: string;
  secretEnv?: string[];
  waitFor?: string[];
  id?: string;
}

export interface BuildOptions {
  machineType?: 'UNSPECIFIED' | 'N1_HIGHCPU_8' | 'N1_HIGHCPU_32' | 'E2_HIGHCPU_8' | 'E2_HIGHCPU_32';
  logging?: 'LOGGING_UNSPECIFIED' | 'LEGACY' | 'GCS_ONLY' | 'STACKDRIVER_ONLY' | 'CLOUD_LOGGING_ONLY' | 'NONE';
}

export interface CloudBuildResponse {
  name: string;
  metadata: {
    '@type': string;
    build: {
      id: string;
      status: string;
      projectId: string;
      logUrl?: string;
    };
  };
}

// ============================================
// GCP Service Account
// ============================================
export interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

// ============================================
// User & Subscription Types
// ============================================
export type UserRole = 'super_admin' | 'user';
export type SubscriptionTier = 'free' | 'pro';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: UserRole;
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  extra_quota_packs: number;
  custom_domain: string | null;
  custom_domain_verified: boolean;
  created_at: number;
  updated_at: number;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: number;
  created_at: number;
}

export interface Deployment {
  id: string;
  user_id: string | null;
  subdomain: string;
  custom_domain: string | null;
  framework: FrameworkType | null;
  status: DeploymentStatus;
  cloud_run_url: string | null;
  has_database: boolean;
  d1_database_id: string | null;
  expires_at: number | null;
  created_at: number;
  updated_at: number;
}

// ============================================
// Quota Types
// ============================================
export interface UserQuota {
  max_deployments: number;
  current_deployments: number;
  remaining: number;
  expires_in_hours: number | null; // For free users
}

export const QUOTA_LIMITS = {
  free: 5,
  pro: 10,
  per_pack: 5,
} as const;

export const FREE_TTL_HOURS = 72;

// ============================================
// Error Types
// ============================================
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
