#!/bin/bash
# Spectre — Google Cloud Run deployment script
# Usage: ./deploy.sh YOUR_PROJECT_ID YOUR_GEMINI_API_KEY

PROJECT_ID=${1:-"your-project-id"}
GEMINI_API_KEY=${2:-"your-gemini-api-key"}
SERVICE_NAME="spectre-backend"
REGION="us-central1"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "🚀 Deploying Spectre to Google Cloud Run..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"

# Build and push Docker image
echo "📦 Building Docker image..."
gcloud builds submit --tag $IMAGE --project $PROJECT_ID

# Deploy to Cloud Run
echo "☁️ Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=$GEMINI_API_KEY \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --project $PROJECT_ID

echo "✅ Deployment complete!"
echo "Backend URL:"
gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)' --project $PROJECT_ID
