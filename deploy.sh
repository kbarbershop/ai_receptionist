#!/bin/bash

# Deploy Script for Square Booking Server (ElevenLabs Integration)
# Last Updated: October 18, 2025 - v2.8.16 Performance Optimizations

set -e  # Exit on error

echo "🚀 Deploying Square Booking Server to Google Cloud Run"
echo "=================================================="

# Configuration
PROJECT_ID="website-473417"
SERVICE_NAME="square-mcp-server"
REGION="us-east4"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

# Square Credentials - CORRECTED TOKEN (Y1OkPC not Y10kPC)
SQUARE_ACCESS_TOKEN="EAAAl6DLAw75VQSm6qSi4cwNA_Y1OkPC4ZtycW-GikXXgDbapqr9aipErTiaXqMr"
SQUARE_LOCATION_ID="LCS4MXPZP8J3M"

echo ""
echo "📦 Step 1: Building Docker image..."
docker build --platform linux/amd64 --no-cache -t ${IMAGE_NAME} .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed!"
    exit 1
fi

echo "✅ Docker image built successfully"
echo ""
echo "🔼 Step 2: Pushing to Google Container Registry..."
docker push ${IMAGE_NAME}

if [ $? -ne 0 ]; then
    echo "❌ Docker push failed!"
    exit 1
fi

echo "✅ Image pushed successfully"
echo ""
echo "☁️  Step 3: Deploying to Cloud Run..."

gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --min-instances 1 \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars SQUARE_ACCESS_TOKEN=${SQUARE_ACCESS_TOKEN},SQUARE_LOCATION_ID=${SQUARE_LOCATION_ID} \
  --project ${PROJECT_ID}

if [ $? -ne 0 ]; then
    echo "❌ Cloud Run deployment failed!"
    exit 1
fi

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "=================================================="
echo "📝 Deployment Summary:"
echo "=================================================="
echo "Service URL: https://square-mcp-server-265357944939.us-east4.run.app"
echo "Region: ${REGION}"
echo "Project: ${PROJECT_ID}"
echo "Min Instances: 1 (always warm - no cold starts)"
echo "Memory: 512Mi"
echo "CPU: 1 vCPU"
echo ""
echo "💰 Estimated Monthly Cost: ~\$63/month"
echo "   (Trade-off: Eliminates 6-second cold starts for instant <50ms responses)"
echo ""
echo "🔧 Available Endpoints:"
echo "  - GET  /health"
echo "  - GET  /analytics/sources"
echo "  - POST /tools/getCurrentDateTime"
echo "  - POST /tools/getAvailability"
echo "  - POST /tools/createBooking"
echo "  - POST /tools/addServicesToBooking"
echo "  - POST /tools/rescheduleBooking"
echo "  - POST /tools/cancelBooking"
echo "  - POST /tools/lookupBooking"
echo "  - POST /tools/lookupCustomer"
echo "  - POST /tools/generalInquiry"
echo ""
echo "🧪 Test Health Check:"
echo "curl https://square-mcp-server-265357944939.us-east4.run.app/health"
echo ""
echo "📊 View Analytics:"
echo "curl https://square-mcp-server-265357944939.us-east4.run.app/analytics/sources"
echo ""
echo "📖 Next Steps:"
echo "1. Test health endpoint above"
echo "2. Test getCurrentDateTime endpoint - should be <50ms"
echo "3. Test generalInquiry - first call ~45ms, cached calls <1ms"
echo "4. Monitor Cloud Run logs for performance metrics"
echo ""
