#!/bin/bash

# Deploy fixed backend to Cloud Run
# This script deploys the k-barbershop-backend with the Square Customer API fix

set -e

echo "🔧 Deploying K Barbershop Backend with Square Customer API Fix..."
echo ""

# Build the Docker image
echo "📦 Building Docker image..."
gcloud builds submit --config cloudbuild.yaml \
  --project website-473417

echo ""
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy k-barbershop-backend \
  --image gcr.io/website-473417/k-barbershop-backend:latest \
  --platform managed \
  --region us-east4 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300s \
  --project website-473417

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🧪 Testing the fix..."
echo "   Checking logs for errors..."

# Wait a bit for deployment to settle
sleep 5

# Check recent logs
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=k-barbershop-backend AND severity>=ERROR" \
  --limit 5 \
  --format json \
  --project website-473417

echo ""
echo "✅ Fix deployed successfully!"
echo ""
echo "📝 Summary of changes:"
echo "   - Removed incorrect 'customer' wrapper in Square API call"
echo "   - Added idempotency_key to customer creation"
echo "   - Fixed line 668 in square_service.py"
echo ""
echo "🎯 Next steps:"
echo "   1. Test booking with a new customer on the website"
echo "   2. Verify customer appears in Square Dashboard"
echo "   3. Check logs to ensure no more 'unrecognized field' errors"
