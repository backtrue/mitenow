#!/bin/bash
# GCP Setup Script for mite.now
# Run this script to set up all required GCP resources

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-your-project-id}"
REGION="${GCP_REGION:-asia-east1}"
SERVICE_ACCOUNT_NAME="mite-worker"

echo "🚀 Setting up GCP resources for mite.now"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Set project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "📦 Enabling required APIs..."
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  storage.googleapis.com \
  pubsub.googleapis.com

# Create Artifact Registry repository
echo "🐳 Creating Artifact Registry repository..."
gcloud artifacts repositories create mite-apps \
  --repository-format=docker \
  --location=$REGION \
  --description="mite.now application images" \
  --quiet || echo "Repository already exists"

# Create GCS bucket for build sources
echo "📁 Creating GCS bucket for uploads..."
gsutil mb -l $REGION gs://mite-uploads-$PROJECT_ID || echo "Bucket already exists"

# Create service account
echo "👤 Creating service account..."
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
  --display-name="mite.now Worker Service Account" \
  --quiet || echo "Service account already exists"

SERVICE_ACCOUNT_EMAIL="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"

# Grant required roles
echo "🔐 Granting IAM roles..."
ROLES=(
  "roles/cloudbuild.builds.editor"
  "roles/run.admin"
  "roles/artifactregistry.writer"
  "roles/storage.objectAdmin"
  "roles/iam.serviceAccountUser"
)

for ROLE in "${ROLES[@]}"; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="$ROLE" \
    --quiet
done

# Create service account key
echo "🔑 Creating service account key..."
KEY_FILE="service-account-key.json"
gcloud iam service-accounts keys create $KEY_FILE \
  --iam-account=$SERVICE_ACCOUNT_EMAIL

# Base64 encode the key for Cloudflare Workers
echo ""
echo "📋 Base64 encoded service account key (for Cloudflare Workers secret):"
echo ""
cat $KEY_FILE | base64 | tr -d '\n'
echo ""
echo ""

# Create Pub/Sub topic for Cloud Build notifications
echo "📨 Setting up Cloud Build notifications..."
TOPIC_NAME="cloud-builds"
gcloud pubsub topics create $TOPIC_NAME || echo "Topic already exists"

# Create push subscription for webhook
echo "Creating Pub/Sub subscription..."
WEBHOOK_URL="https://api.mite.now/api/v1/webhook/cloudbuild"
gcloud pubsub subscriptions create cloud-builds-webhook \
  --topic=$TOPIC_NAME \
  --push-endpoint=$WEBHOOK_URL \
  --ack-deadline=60 \
  --quiet || echo "Subscription already exists"

# Configure Cloud Build to publish to Pub/Sub
echo "Configuring Cloud Build notifications..."
gcloud builds triggers create pubsub \
  --topic=projects/$PROJECT_ID/topics/$TOPIC_NAME \
  --build-config="" \
  --quiet || echo "Trigger already exists"

echo ""
echo "✅ GCP setup complete!"
echo ""
echo "Next steps:"
echo "1. Store the service account key in Cloudflare Workers secrets:"
echo "   wrangler secret put GCP_SERVICE_ACCOUNT_KEY"
echo "   (paste the base64 encoded key above)"
echo ""
echo "2. Set the GCP project ID:"
echo "   wrangler secret put GCP_PROJECT_ID"
echo "   (enter: $PROJECT_ID)"
echo ""
echo "3. Update wrangler.toml with your Cloudflare resource IDs"
echo ""
echo "4. Deploy the worker:"
echo "   cd worker && npm run deploy"
echo ""
echo "⚠️  Remember to delete the local key file:"
echo "   rm $KEY_FILE"
