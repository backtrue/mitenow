/**
 * Application Configuration
 * Centralized configuration management for the Worker
 */

// ============================================
// Session Configuration
// ============================================

export const SESSION_CONFIG = {
    // Session duration in milliseconds (default: 30 days)
    DURATION_MS: 30 * 24 * 60 * 60 * 1000,

    // Cookie settings
    COOKIE_NAME: 'session_id',
    COOKIE_SAME_SITE: 'lax' as const,
    COOKIE_SECURE: true,

    // Token settings
    TOKEN_LENGTH: 32,
};

// ============================================
// Rate Limiting Configuration
// ============================================

export const RATE_LIMIT_CONFIG = {
    // Prepare endpoint
    prepare: {
        maxRequests: 10,
        windowSeconds: 60,
    },

    // Deploy endpoint
    deploy: {
        maxRequests: 5,
        windowSeconds: 60,
    },

    // Upload endpoint
    upload: {
        maxRequests: 3,
        windowSeconds: 60,
    },

    // Status check endpoint
    status: {
        maxRequests: 60,
        windowSeconds: 60,
    },

    // Auth endpoints
    auth: {
        maxRequests: 5,
        windowSeconds: 300, // 5 minutes
    },

    // Subdomain check endpoint
    subdomain: {
        maxRequests: 20,
        windowSeconds: 60,
    },

    // General API endpoints
    default: {
        maxRequests: 100,
        windowSeconds: 60,
    },
};

// ============================================
// File Upload Configuration
// ============================================

export const UPLOAD_CONFIG = {
    // Maximum ZIP file size (50MB)
    MAX_ZIP_SIZE: 50 * 1024 * 1024,

    // Maximum uncompressed size (200MB)
    MAX_UNCOMPRESSED_SIZE: 200 * 1024 * 1024,

    // Maximum single file size within ZIP (10MB)
    MAX_SINGLE_FILE_SIZE: 10 * 1024 * 1024,

    // Maximum number of files in ZIP
    MAX_FILE_COUNT: 1000,

    // Allowed file extensions
    ALLOWED_EXTENSIONS: ['.zip'],

    // Upload URL expiry (1 hour)
    UPLOAD_URL_EXPIRY_SECONDS: 3600,
};

// ============================================
// Quota Configuration
// ============================================

export const QUOTA_CONFIG = {
    // Free tier limits
    free: {
        maxDeployments: 5,
        ttlHours: 72, // 3 days
        description: 'Free tier - 5 deployments, 72h TTL',
    },

    // Pro tier limits
    pro: {
        maxDeployments: 10,
        ttlHours: null, // No expiry
        description: 'Pro tier - 10 deployments, no TTL',
    },

    // Per quota pack
    quotaPack: {
        additionalDeployments: 5,
        description: 'Quota pack - adds 5 deployments',
    },
};

// ============================================
// Deployment Configuration
// ============================================

export const DEPLOYMENT_CONFIG = {
    // Reserved subdomains
    RESERVED_SUBDOMAINS: [
        'www',
        'api',
        'admin',
        'mail',
        'smtp',
        'ftp',
        'ssh',
        'test',
        'dev',
        'staging',
        'prod',
        'app',
        'dashboard',
        'status',
        'help',
        'support',
        'docs',
        'blog',
    ],

    // Subdomain validation
    SUBDOMAIN_MIN_LENGTH: 3,
    SUBDOMAIN_MAX_LENGTH: 30,
    SUBDOMAIN_PATTERN: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,

    // Status check interval (ms)
    STATUS_POLL_INTERVAL: 5000,

    // Build timeout (ms)
    BUILD_TIMEOUT: 10 * 60 * 1000, // 10 minutes
};

// ============================================
// Security Configuration
// ============================================

export const SECURITY_CONFIG = {
    // Content Security Policy
    CSP_DIRECTIVES: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'https:'],
        'connect-src': ["'self'", 'https://api.mite.now'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
    },

    // Allowed CORS origins (default)
    DEFAULT_ALLOWED_ORIGINS: [
        'https://mite.now',
        'https://www.mite.now',
        'http://localhost:3000',
    ],

    // API key validation
    API_KEY_MIN_LENGTH: 20,
    API_KEY_MAX_LENGTH: 100,
    API_KEY_PATTERN: /^[A-Za-z0-9_-]+$/,
};

// ============================================
// GCP Configuration
// ============================================

export const GCP_CONFIG = {
    // Default region
    DEFAULT_REGION: 'asia-east1',

    // Cloud Build settings
    CLOUD_BUILD_TIMEOUT: '600s', // 10 minutes
    CLOUD_BUILD_MACHINE_TYPE: 'N1_HIGHCPU_8',

    // Cloud Run settings
    CLOUD_RUN_MIN_INSTANCES: 0,
    CLOUD_RUN_MAX_INSTANCES: 10,
    CLOUD_RUN_MEMORY: '512Mi',
    CLOUD_RUN_CPU: '1',
    CLOUD_RUN_CONCURRENCY: 80,
    CLOUD_RUN_TIMEOUT: '300s',

    // Artifact Registry
    ARTIFACT_REGISTRY_REPO: 'mite-apps',
};

// ============================================
// Monitoring Configuration
// ============================================

export const MONITORING_CONFIG = {
    // Slow request threshold (ms)
    SLOW_REQUEST_THRESHOLD: 5000,

    // Error sample rate for Sentry
    ERROR_SAMPLE_RATE: 1.0, // 100%

    // Performance sample rate for Sentry
    PERFORMANCE_SAMPLE_RATE: 0.1, // 10%

    // Health check endpoint
    HEALTH_CHECK_PATH: '/api/v1/health',
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get rate limit config for an endpoint
 */
export function getRateLimitConfig(endpoint: string) {
    const key = endpoint as keyof typeof RATE_LIMIT_CONFIG;
    return RATE_LIMIT_CONFIG[key] || RATE_LIMIT_CONFIG.default;
}

/**
 * Check if a subdomain is reserved
 */
export function isReservedSubdomain(subdomain: string): boolean {
    return DEPLOYMENT_CONFIG.RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase());
}

/**
 * Validate subdomain format
 */
export function isValidSubdomain(subdomain: string): boolean {
    if (subdomain.length < DEPLOYMENT_CONFIG.SUBDOMAIN_MIN_LENGTH) return false;
    if (subdomain.length > DEPLOYMENT_CONFIG.SUBDOMAIN_MAX_LENGTH) return false;
    return DEPLOYMENT_CONFIG.SUBDOMAIN_PATTERN.test(subdomain);
}
