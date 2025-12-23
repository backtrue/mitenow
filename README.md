# mite.now

> Deploy AI Studio apps in 60 seconds ⚡

mite.now is a Micro-SaaS platform that lets users drag-and-drop Google AI Studio exported ZIP files and automatically deploy them as web applications with custom `[slug].mite.now` URLs.

## 🎯 Core Value Proposition

- **Zero DevOps**: No Git, no Docker knowledge required
- **60-Second Deploy**: From ZIP upload to live URL
- **Custom Subdomains**: Professional `your-app.mite.now` URLs
- **Scale-to-Zero**: Cost-effective Cloud Run hosting

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              User Flow                                    │
│  [Upload ZIP] → [Enter API Key] → [Choose Subdomain] → [Deploy!]         │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         Cloudflare Edge                                   │
├──────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐   ┌────────────────┐   ┌────────────────────────┐   │
│  │    Workers     │   │       R2       │   │          KV            │   │
│  │   (API/Proxy)  │   │   (ZIP Store)  │   │   (Routing Table)      │   │
│  └────────────────┘   └────────────────┘   └────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      Google Cloud Platform                                │
├──────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐   ┌────────────────┐   ┌────────────────────────┐   │
│  │  Cloud Build   │──▶│   Artifact     │──▶│      Cloud Run         │   │
│  │    (CI/CD)     │   │   Registry     │   │   (Scale-to-Zero)      │   │
│  └────────────────┘   └────────────────┘   └────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
mite/
├── worker/                    # Cloudflare Worker (API & Proxy)
│   ├── src/
│   │   ├── index.ts          # Main entry point & router
│   │   ├── types/            # TypeScript definitions
│   │   ├── handlers/         # API endpoint handlers
│   │   │   ├── prepare.ts    # /api/v1/prepare - Upload URL generation
│   │   │   ├── deploy.ts     # /api/v1/deploy - Trigger deployment
│   │   │   ├── status.ts     # /api/v1/status/:id - Check status
│   │   │   ├── proxy.ts      # Wildcard subdomain routing
│   │   │   └── webhook.ts    # Cloud Build notifications
│   │   └── utils/            # Utility functions
│   │       ├── gcp-auth.ts   # GCP JWT authentication
│   │       ├── cloud-build.ts# Cloud Build API integration
│   │       ├── r2.ts         # R2 storage operations
│   │       └── kv.ts         # KV state management
│   ├── wrangler.toml         # Cloudflare configuration
│   └── package.json
│
├── gcp/                       # GCP Configuration
│   ├── cloudbuild-streamlit.yaml
│   ├── cloudbuild-gradio.yaml
│   └── setup.sh              # GCP resource setup script
│
├── frontend/                  # Next.js Frontend (TODO)
│   └── ...
│
└── PRD+SDD.md                # Product & System Design Document
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- Cloudflare account (Workers, R2, KV)
- GCP account (Cloud Build, Cloud Run, Artifact Registry)
- Wrangler CLI: `npm install -g wrangler`

### 1. Clone & Install

```bash
git clone https://github.com/your-org/mite.git
cd mite/worker
npm install
```

### 2. Setup Cloudflare Resources

```bash
# Login
wrangler login

# Create KV namespace
wrangler kv:namespace create "MITE_KV"

# Create R2 bucket
wrangler r2 bucket create mite-uploads
```

### 3. Setup GCP Resources

```bash
cd ../gcp
chmod +x setup.sh
./setup.sh
```

### 4. Configure Secrets

```bash
cd ../worker

# Set GCP credentials
wrangler secret put GCP_PROJECT_ID
wrangler secret put GCP_SERVICE_ACCOUNT_KEY

# Set API secret (generate with: openssl rand -hex 32)
wrangler secret put API_SECRET_KEY
```

### 5. Deploy

```bash
npm run deploy
```

## 📡 API Reference

### POST `/api/v1/prepare`

Get a pre-signed URL for ZIP upload.

**Request:**
```json
{
  "filename": "my-app.zip"
}
```

**Response:**
```json
{
  "app_id": "app_xyz123",
  "upload_url": "https://api.mite.now/api/v1/upload/app_xyz123?token=...",
  "expires_at": "2024-01-01T12:00:00Z"
}
```

### POST `/api/v1/deploy`

Trigger deployment after upload.

**Request:**
```json
{
  "app_id": "app_xyz123",
  "api_key": "AIza...",
  "subdomain": "my-cool-app"
}
```

**Response:**
```json
{
  "app_id": "app_xyz123",
  "subdomain": "my-cool-app",
  "status": "building",
  "message": "Deployment started. Your app will be available at https://my-cool-app.mite.now"
}
```

### GET `/api/v1/status/:id`

Check deployment status.

**Response:**
```json
{
  "app_id": "app_xyz123",
  "subdomain": "my-cool-app",
  "status": "active",
  "target_url": "https://my-cool-app.mite.now",
  "created_at": "2024-01-01T11:00:00Z",
  "updated_at": "2024-01-01T11:01:30Z"
}
```

## 🔒 Security

- **API Keys**: User's Gemini API keys are NEVER stored persistently. They are passed transiently to Cloud Build and set as Cloud Run environment variables only.
- **CORS**: Strict origin validation for API endpoints.
- **Upload Tokens**: HMAC-SHA256 signed with expiration.
- **Container Isolation**: Cloud Run gen2 execution environment (gVisor).

## 🛠️ Supported Frameworks

| Framework | Detection | Port |
|-----------|-----------|------|
| Streamlit | `streamlit` in requirements.txt | 8080 |
| Gradio | `gradio` in requirements.txt | 8080 |
| Flask | `flask` in requirements.txt | 8080 |

## 📊 Deployment Status Flow

```
pending → analyzing → building → deploying → active
                                     ↓
                                  failed
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

Built with ❤️ using Cloudflare Workers & Google Cloud
