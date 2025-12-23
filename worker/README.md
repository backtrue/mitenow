# mite.now - Cloudflare Worker

Cloudflare Worker API for mite.now - Deploy AI Studio apps in 60 seconds.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare Edge                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   Worker    │    │     R2      │    │         KV          │ │
│  │   (API)     │───▶│  (Storage)  │    │  (Routing Table)    │ │
│  └─────────────┘    └─────────────┘    └─────────────────────┘ │
│         │                  │                      │             │
└─────────┼──────────────────┼──────────────────────┼─────────────┘
          │                  │                      │
          ▼                  ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Google Cloud Platform                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │ Cloud Build │───▶│  Artifact   │───▶│     Cloud Run       │ │
│  │   (CI/CD)   │    │  Registry   │    │    (Runtime)        │ │
│  └─────────────┘    └─────────────┘    └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/prepare` | Get pre-signed URL for ZIP upload |
| POST | `/api/v1/upload/:appId` | Upload ZIP file to R2 |
| POST | `/api/v1/deploy` | Trigger Cloud Build deployment |
| GET | `/api/v1/status/:id` | Query deployment status |
| GET | `/api/v1/health` | Health check |

## Setup

### Prerequisites

- Node.js >= 18
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account with Workers, R2, and KV enabled
- GCP project with Cloud Build and Cloud Run APIs enabled

### 1. Install Dependencies

```bash
cd worker
npm install
```

### 2. Configure Cloudflare Resources

```bash
# Login to Cloudflare
wrangler login

# Create KV namespace
wrangler kv:namespace create "MITE_KV"
wrangler kv:namespace create "MITE_KV" --preview

# Create R2 bucket
wrangler r2 bucket create mite-uploads
```

### 3. Update wrangler.toml

Replace placeholder IDs in `wrangler.toml` with actual resource IDs from step 2.

### 4. Set Secrets

```bash
# GCP Project ID
wrangler secret put GCP_PROJECT_ID

# GCP Service Account Key (base64 encoded)
# First encode: cat service-account.json | base64
wrangler secret put GCP_SERVICE_ACCOUNT_KEY

# API Secret Key (for signing tokens)
# Generate: openssl rand -hex 32
wrangler secret put API_SECRET_KEY
```

### 5. GCP Setup

1. Create a GCP project
2. Enable APIs:
   - Cloud Build API
   - Cloud Run API
   - Artifact Registry API

3. Create Service Account with roles:
   - `roles/cloudbuild.builds.editor`
   - `roles/run.admin`
   - `roles/artifactregistry.writer`
   - `roles/iam.serviceAccountUser`

4. Create Artifact Registry repository:
```bash
gcloud artifacts repositories create mite-apps \
  --repository-format=docker \
  --location=asia-east1 \
  --description="mite.now app images"
```

5. Create GCS bucket for build sources (Cloud Build needs GCS):
```bash
gsutil mb -l asia-east1 gs://mite-uploads
```

## Development

```bash
# Start local dev server
npm run dev

# Type checking
npm run typecheck

# Run tests
npm test
```

## Deployment

```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

## Project Structure

```
worker/
├── src/
│   ├── index.ts           # Main entry point & router
│   ├── types/
│   │   └── index.ts       # TypeScript type definitions
│   ├── handlers/
│   │   ├── prepare.ts     # /api/v1/prepare handler
│   │   ├── deploy.ts      # /api/v1/deploy handler
│   │   ├── status.ts      # /api/v1/status/:id handler
│   │   └── proxy.ts       # Wildcard subdomain proxy
│   └── utils/
│       ├── gcp-auth.ts    # GCP authentication (JWT/OAuth)
│       ├── cloud-build.ts # Cloud Build API integration
│       ├── r2.ts          # R2 storage utilities
│       └── kv.ts          # KV storage utilities
├── package.json
├── tsconfig.json
├── wrangler.toml          # Cloudflare Worker config
└── README.md
```

## Security Considerations

1. **API Key Handling**: User's Gemini API keys are NEVER stored in KV or R2. They are passed transiently to Cloud Build and set as Cloud Run environment variables only.

2. **CORS**: Strict origin checking - only allows requests from `mite.now` domains.

3. **Upload Tokens**: Pre-signed URLs use HMAC-SHA256 signed tokens with expiration.

4. **GCP Authentication**: Uses Service Account with minimal required permissions.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GCP_PROJECT_ID` | GCP project ID | Yes |
| `GCP_SERVICE_ACCOUNT_KEY` | Base64 encoded service account JSON | Yes |
| `GCP_REGION` | GCP region (default: asia-east1) | No |
| `API_SECRET_KEY` | Secret for signing tokens | Yes |
| `ALLOWED_ORIGINS` | Comma-separated allowed CORS origins | No |

## License

MIT
