/**
 * Google Cloud Build Integration
 * Handles build triggering, Dockerfile generation, and Cloud Run deployment
 */

import type {
  Env,
  CloudBuildConfig,
  CloudBuildResponse,
  FrameworkType,
  ZipAnalysisResult
} from '../types';
import { ApiError } from '../types';
import { generateGCPAccessToken, parseServiceAccountKey } from './gcp-auth';

// ============================================
// Dockerfile Templates
// ============================================
const DOCKERFILE_TEMPLATES: Record<FrameworkType, string> = {
  streamlit: `FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    build-essential \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8080/_stcore/health || exit 1

# Run Streamlit
CMD ["streamlit", "run", "app.py", "--server.port=8080", "--server.address=0.0.0.0", "--server.headless=true", "--browser.gatherUsageStats=false"]
`,

  gradio: `FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    build-essential \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8080

# Environment variables for Gradio
ENV GRADIO_SERVER_NAME="0.0.0.0"
ENV GRADIO_SERVER_PORT=8080

# Run application
CMD ["python", "app.py"]
`,

  flask: `FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    build-essential \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy application code
COPY . .

# Expose port
EXPOSE 8080

# Run with Gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--threads", "2", "app:app"]
`,

  unknown: `FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    build-essential \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8080

# Default to running app.py
CMD ["python", "app.py"]
`,

  react: `FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install for projects without lock file)
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config for SPA routing
RUN echo 'server { \\
    listen 8080; \\
    location / { \\
        root /usr/share/nginx/html; \\
        index index.html; \\
        try_files $uri $uri/ /index.html; \\
    } \\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
`,

  nextjs: `FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install for projects without lock file)
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy public folder if it exists (use shell form to handle missing dir)
RUN mkdir -p ./public
COPY --from=builder /app/public* ./public/

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "start"]
`,

  fastapi: `FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    build-essential \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt uvicorn

# Copy application code
COPY . .

# Expose port
EXPOSE 8080

# Run with Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
`,

  express: `FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install for projects without lock file)
RUN npm install --omit=dev

# Copy application code
COPY . .

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Try common entry points: index.js, server.js, app.js, or use npm start
CMD ["sh", "-c", "node \${ENTRY_FILE:-index.js} || npm start"]
`,

  static: `FROM nginx:alpine

# Copy static files
COPY . /usr/share/nginx/html

# Configure nginx for SPA and port 8080
RUN echo 'server { \\
    listen 8080; \\
    root /usr/share/nginx/html; \\
    index index.html; \\
    location / { \\
        try_files $uri $uri/ /index.html; \\
    } \\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
`
};

// ============================================
// Default requirements.txt
// ============================================
const DEFAULT_REQUIREMENTS: Record<FrameworkType, string> = {
  streamlit: `streamlit>=1.28.0
google-generativeai>=0.3.0
python-dotenv>=1.0.0
`,
  gradio: `gradio>=4.0.0
google-generativeai>=0.3.0
python-dotenv>=1.0.0
`,
  flask: `flask>=3.0.0
google-generativeai>=0.3.0
python-dotenv>=1.0.0
gunicorn>=21.0.0
`,
  fastapi: `fastapi>=0.104.0
google-generativeai>=0.3.0
python-dotenv>=1.0.0
uvicorn>=0.24.0
`,
  react: '', // React uses package.json, not requirements.txt
  nextjs: '', // Next.js uses package.json, not requirements.txt
  express: '', // Express uses package.json, not requirements.txt
  static: '', // Static sites don't need requirements
  unknown: `google-generativeai>=0.3.0
python-dotenv>=1.0.0
`
};

// ============================================
// Cloud Build Functions
// ============================================

/**
 * Trigger a Cloud Build for the given app
 */
export async function triggerCloudBuild(
  env: Env,
  appId: string,
  subdomain: string,
  analysis: ZipAnalysisResult,
  secretResourceName: string
): Promise<CloudBuildResponse> {
  // Get access token with full cloud-platform scope
  const accessToken = await generateGCPAccessToken(
    env.GCP_SERVICE_ACCOUNT_KEY,
    ['https://www.googleapis.com/auth/cloud-platform']
  );

  const serviceAccount = parseServiceAccountKey(env.GCP_SERVICE_ACCOUNT_KEY);
  const projectId = env.GCP_PROJECT_ID || serviceAccount.project_id;
  const region = env.GCP_REGION || 'asia-east1';

  // Use the worker service account for Cloud Run as well, since it has the correct permissions
  const serviceAccountEmail = serviceAccount.client_email;

  // Generate image name
  const imageName = `${region}-docker.pkg.dev/${projectId}/mite-apps/${subdomain}:latest`;

  // Create Cloud Build configuration
  const buildConfig = createBuildConfig({
    projectId,
    region,
    appId,
    subdomain,
    imageName,
    framework: analysis.framework,
    hasRequirements: analysis.has_requirements,
    secretResourceName,
    serviceAccountEmail
  });

  // Submit build
  const response = await fetch(
    `https://cloudbuild.googleapis.com/v1/projects/${projectId}/builds`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildConfig)
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new ApiError(500, `Cloud Build API error: ${error}`, 'CLOUD_BUILD_ERROR');
  }

  return response.json() as Promise<CloudBuildResponse>;
}

interface BuildConfigParams {
  projectId: string;
  region: string;
  appId: string;
  subdomain: string;
  imageName: string;
  framework: FrameworkType;
  hasRequirements: boolean;
  secretResourceName: string;
  serviceAccountEmail: string;
}

/**
 * Create Cloud Build configuration
 */
function createBuildConfig(params: BuildConfigParams): CloudBuildConfig {
  const {
    region,
    appId,
    subdomain,
    imageName,
    framework,
    hasRequirements,
    secretResourceName,
    serviceAccountEmail
  } = params;

  // projectId is used in the caller for API endpoint, not needed here
  void params.projectId;

  const dockerfile = DOCKERFILE_TEMPLATES[framework];
  const defaultRequirements = DEFAULT_REQUIREMENTS[framework];

  // Build steps
  const steps = [
    // Step 1: Download source from R2 (via GCS transfer or direct)
    // For now, we assume source is already in GCS bucket
    {
      name: 'gcr.io/cloud-builders/gsutil',
      args: ['cp', `gs://mite-uploads-omakase-481015/${appId}/source.zip`, '/workspace/source.zip'],
      id: 'download-source'
    },

    // Step 2: Extract ZIP
    {
      name: 'ubuntu',
      entrypoint: 'bash',
      args: [
        '-c',
        'apt-get update && apt-get install -y unzip && unzip /workspace/source.zip -d /workspace/app'
      ],
      id: 'extract-zip',
      waitFor: ['download-source']
    },

    // Step 3: Inject Dockerfile
    {
      name: 'ubuntu',
      entrypoint: 'bash',
      args: [
        '-c',
        `cat > /workspace/app/Dockerfile << 'DOCKERFILE_EOF'
${dockerfile}
DOCKERFILE_EOF`
      ],
      id: 'inject-dockerfile',
      waitFor: ['extract-zip']
    },

    // Step 4: Inject default requirements.txt if missing
    ...(hasRequirements ? [] : [{
      name: 'ubuntu',
      entrypoint: 'bash',
      args: [
        '-c',
        `cat > /workspace/app/requirements.txt << 'REQUIREMENTS_EOF'
${defaultRequirements}
REQUIREMENTS_EOF`
      ],
      id: 'inject-requirements',
      waitFor: ['extract-zip']
    }]),

    // Step 5: Build Docker image
    {
      name: 'gcr.io/cloud-builders/docker',
      args: ['build', '-t', imageName, '/workspace/app'],
      id: 'build-image',
      waitFor: hasRequirements ? ['inject-dockerfile'] : ['inject-dockerfile', 'inject-requirements']
    },

    // Step 6: Push to Artifact Registry
    {
      name: 'gcr.io/cloud-builders/docker',
      args: ['push', imageName],
      id: 'push-image',
      waitFor: ['build-image']
    },

    // Step 7: Deploy to Cloud Run with Secret Manager
    {
      name: 'gcr.io/google.com/cloudsdktool/cloud-sdk',
      entrypoint: 'gcloud',
      args: [
        'run', 'deploy', subdomain,
        '--image', imageName,
        '--region', region,
        '--platform', 'managed',
        '--memory', '512Mi',
        '--cpu', '1',
        '--min-instances', '0',
        '--max-instances', '3',
        '--timeout', '300',
        '--remove-env-vars', 'GOOGLE_API_KEY',
        '--set-secrets', `GOOGLE_API_KEY=${secretResourceName}`,
        '--service-account', serviceAccountEmail,
        '--port', '8080',
        '--execution-environment', 'gen2'
      ],
      id: 'deploy-cloudrun',
      waitFor: ['push-image']
    },

    // Step 8: Make Cloud Run service publicly accessible
    {
      name: 'gcr.io/google.com/cloudsdktool/cloud-sdk',
      entrypoint: 'gcloud',
      args: [
        'run', 'services', 'add-iam-policy-binding', subdomain,
        '--region', region,
        '--member', 'allUsers',
        '--role', 'roles/run.invoker'
      ],
      id: 'set-public-access',
      waitFor: ['deploy-cloudrun']
    }
  ];

  return {
    source: {
      storageSource: {
        bucket: 'mite-uploads-omakase-481015',
        object: `${appId}/source.zip`
      }
    },
    steps,
    images: [imageName],
    options: {
      machineType: 'E2_HIGHCPU_8',
      logging: 'CLOUD_LOGGING_ONLY'
    },
    timeout: '600s' // 10 minutes max
  };
}

/**
 * Get Cloud Build status
 */
export async function getBuildStatus(
  env: Env,
  buildId: string
): Promise<{ status: string; logUrl?: string; serviceUrl?: string }> {
  const accessToken = await generateGCPAccessToken(
    env.GCP_SERVICE_ACCOUNT_KEY,
    ['https://www.googleapis.com/auth/cloudbuild']
  );

  const projectId = env.GCP_PROJECT_ID;

  const response = await fetch(
    `https://cloudbuild.googleapis.com/v1/projects/${projectId}/builds/${buildId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    throw new ApiError(500, 'Failed to get build status');
  }

  const build = await response.json() as {
    status: string;
    logUrl?: string;
    results?: {
      images?: Array<{ name: string }>;
    };
  };

  return {
    status: build.status,
    logUrl: build.logUrl
  };
}

/**
 * Get Cloud Run service URL
 */
export async function getCloudRunServiceUrl(
  env: Env,
  serviceName: string
): Promise<string | null> {
  const accessToken = await generateGCPAccessToken(
    env.GCP_SERVICE_ACCOUNT_KEY,
    ['https://www.googleapis.com/auth/cloud-platform']
  );

  const projectId = env.GCP_PROJECT_ID;
  const region = env.GCP_REGION || 'asia-east1';

  const response = await fetch(
    `https://run.googleapis.com/v2/projects/${projectId}/locations/${region}/services/${serviceName}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    return null;
  }

  const service = await response.json() as {
    uri?: string;
  };

  return service.uri || null;
}

/**
 * Analyze ZIP contents to detect framework
 * Note: This is a simplified version - actual implementation would parse the ZIP
 */
export function analyzeZipContents(files: string[], requirementsContent?: string): ZipAnalysisResult {
  let framework: FrameworkType = 'unknown';
  let entrypoint = 'app.py';
  const hasRequirements = files.includes('requirements.txt');

  // Check for main entry points
  if (files.includes('app.py')) {
    entrypoint = 'app.py';
  } else if (files.includes('main.py')) {
    entrypoint = 'main.py';
  }

  // Detect framework from requirements.txt content
  if (requirementsContent) {
    const lowerContent = requirementsContent.toLowerCase();
    if (lowerContent.includes('streamlit')) {
      framework = 'streamlit';
    } else if (lowerContent.includes('gradio')) {
      framework = 'gradio';
    } else if (lowerContent.includes('flask')) {
      framework = 'flask';
    }
  }

  return {
    framework,
    entrypoint,
    has_requirements: hasRequirements,
    files
  };
}
