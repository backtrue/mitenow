#!/bin/bash
# GCP Monitoring Setup Script for mite.now
# Run this script to set up Cloud Monitoring alerts and dashboards

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-your-project-id}"
REGION="${GCP_REGION:-asia-east1}"
NOTIFICATION_EMAIL="${NOTIFICATION_EMAIL:-admin@mite.now}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

echo "🔔 Setting up GCP Cloud Monitoring for mite.now"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Notification Email: $NOTIFICATION_EMAIL"
echo ""

# Set project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "📦 Enabling monitoring APIs..."
gcloud services enable \
  monitoring.googleapis.com \
  logging.googleapis.com \
  cloudtrace.googleapis.com

# ============================================
# Create Notification Channels
# ============================================

echo "📧 Creating email notification channel..."
EMAIL_CHANNEL_ID=$(gcloud beta monitoring channels create \
  --display-name="mite.now Admin Email" \
  --type=email \
  --channel-labels=email_address=$NOTIFICATION_EMAIL \
  --format="value(name)" 2>/dev/null || echo "")

if [ -n "$EMAIL_CHANNEL_ID" ]; then
  echo "Created email channel: $EMAIL_CHANNEL_ID"
else
  echo "Email channel already exists or failed to create"
  EMAIL_CHANNEL_ID=$(gcloud beta monitoring channels list \
    --filter="displayName='mite.now Admin Email'" \
    --format="value(name)" | head -1)
fi

# Create Slack channel if webhook provided
if [ -n "$SLACK_WEBHOOK_URL" ]; then
  echo "📱 Creating Slack notification channel..."
  SLACK_CHANNEL_ID=$(gcloud beta monitoring channels create \
    --display-name="mite.now Slack" \
    --type=slack \
    --channel-labels=auth_token="$SLACK_WEBHOOK_URL" \
    --format="value(name)" 2>/dev/null || echo "")
fi

# ============================================
# Cloud Run Alert Policies
# ============================================

echo "🚨 Creating Cloud Run alert policies..."

# Alert: High Error Rate (> 1% of requests)
cat > /tmp/cloud-run-error-rate.json << EOF
{
  "displayName": "mite.now - Cloud Run High Error Rate",
  "conditions": [
    {
      "displayName": "Error rate > 1%",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.labels.response_code_class!=\"2xx\"",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_RATE"
          }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": 0.01,
        "duration": "300s",
        "trigger": {
          "count": 1
        }
      }
    }
  ],
  "combiner": "OR",
  "enabled": true,
  "notificationChannels": ["$EMAIL_CHANNEL_ID"],
  "alertStrategy": {
    "autoClose": "604800s"
  }
}
EOF

gcloud alpha monitoring policies create --policy-from-file=/tmp/cloud-run-error-rate.json 2>/dev/null || echo "Error rate policy already exists"

# Alert: High Latency (p99 > 10s)
cat > /tmp/cloud-run-latency.json << EOF
{
  "displayName": "mite.now - Cloud Run High Latency",
  "conditions": [
    {
      "displayName": "p99 latency > 10s",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_latencies\"",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_PERCENTILE_99"
          }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": 10000,
        "duration": "300s",
        "trigger": {
          "count": 1
        }
      }
    }
  ],
  "combiner": "OR",
  "enabled": true,
  "notificationChannels": ["$EMAIL_CHANNEL_ID"]
}
EOF

gcloud alpha monitoring policies create --policy-from-file=/tmp/cloud-run-latency.json 2>/dev/null || echo "Latency policy already exists"

# Alert: Instance Count Spike
cat > /tmp/cloud-run-instances.json << EOF
{
  "displayName": "mite.now - Cloud Run Instance Spike",
  "conditions": [
    {
      "displayName": "Instance count > 50",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/container/instance_count\"",
        "aggregations": [
          {
            "alignmentPeriod": "60s",
            "perSeriesAligner": "ALIGN_MAX"
          }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": 50,
        "duration": "300s",
        "trigger": {
          "count": 1
        }
      }
    }
  ],
  "combiner": "OR",
  "enabled": true,
  "notificationChannels": ["$EMAIL_CHANNEL_ID"]
}
EOF

gcloud alpha monitoring policies create --policy-from-file=/tmp/cloud-run-instances.json 2>/dev/null || echo "Instance count policy already exists"

# ============================================
# Cloud Build Alert Policies
# ============================================

echo "🔨 Creating Cloud Build alert policies..."

# Alert: Build Failure Rate
cat > /tmp/cloud-build-failures.json << EOF
{
  "displayName": "mite.now - Cloud Build Failures",
  "conditions": [
    {
      "displayName": "Build failure rate > 10%",
      "conditionThreshold": {
        "filter": "resource.type=\"build\" AND metric.type=\"cloudbuild.googleapis.com/build/count\" AND metric.labels.status=\"FAILURE\"",
        "aggregations": [
          {
            "alignmentPeriod": "3600s",
            "perSeriesAligner": "ALIGN_RATE"
          }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": 0.1,
        "duration": "0s",
        "trigger": {
          "count": 1
        }
      }
    }
  ],
  "combiner": "OR",
  "enabled": true,
  "notificationChannels": ["$EMAIL_CHANNEL_ID"]
}
EOF

gcloud alpha monitoring policies create --policy-from-file=/tmp/cloud-build-failures.json 2>/dev/null || echo "Build failure policy already exists"

# ============================================
# Create Monitoring Dashboard
# ============================================

echo "📊 Creating monitoring dashboard..."

cat > /tmp/mite-dashboard.json << EOF
{
  "displayName": "mite.now Overview",
  "gridLayout": {
    "columns": "2",
    "widgets": [
      {
        "title": "Cloud Run Request Count",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_count\"",
                "aggregation": {
                  "alignmentPeriod": "60s",
                  "perSeriesAligner": "ALIGN_RATE"
                }
              }
            }
          }]
        }
      },
      {
        "title": "Cloud Run Latency (p50, p99)",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_latencies\"",
                "aggregation": {
                  "alignmentPeriod": "60s",
                  "perSeriesAligner": "ALIGN_PERCENTILE_50"
                }
              }
            }
          }]
        }
      },
      {
        "title": "Cloud Run Error Rate",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.labels.response_code_class!=\"2xx\"",
                "aggregation": {
                  "alignmentPeriod": "60s",
                  "perSeriesAligner": "ALIGN_RATE"
                }
              }
            }
          }]
        }
      },
      {
        "title": "Cloud Run Instance Count",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/container/instance_count\"",
                "aggregation": {
                  "alignmentPeriod": "60s",
                  "perSeriesAligner": "ALIGN_MAX"
                }
              }
            }
          }]
        }
      },
      {
        "title": "Cloud Build Duration",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\"build\" AND metric.type=\"cloudbuild.googleapis.com/build/duration\"",
                "aggregation": {
                  "alignmentPeriod": "3600s",
                  "perSeriesAligner": "ALIGN_MEAN"
                }
              }
            }
          }]
        }
      },
      {
        "title": "Cloud Build Status",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\"build\" AND metric.type=\"cloudbuild.googleapis.com/build/count\"",
                "aggregation": {
                  "alignmentPeriod": "3600s",
                  "perSeriesAligner": "ALIGN_SUM"
                }
              }
            }
          }]
        }
      }
    ]
  }
}
EOF

gcloud monitoring dashboards create --config-from-file=/tmp/mite-dashboard.json 2>/dev/null || echo "Dashboard already exists"

# ============================================
# Cleanup
# ============================================

rm -f /tmp/cloud-run-error-rate.json
rm -f /tmp/cloud-run-latency.json
rm -f /tmp/cloud-run-instances.json
rm -f /tmp/cloud-build-failures.json
rm -f /tmp/mite-dashboard.json

echo ""
echo "✅ GCP Monitoring setup complete!"
echo ""
echo "📊 View your dashboard:"
echo "   https://console.cloud.google.com/monitoring/dashboards?project=$PROJECT_ID"
echo ""
echo "🔔 View alert policies:"
echo "   https://console.cloud.google.com/monitoring/alerting?project=$PROJECT_ID"
echo ""
echo "⚠️  Note: Make sure to verify the notification channel and test alerts"
