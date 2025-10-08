#!/bin/bash

# Quick test script to verify the Square Customer API fix
# Tests customer creation after deployment

echo "🧪 Testing Square Customer API Fix..."
echo ""

SERVICE_URL="https://k-barbershop-backend-265357944939.us-east4.run.app"

# Test 1: Check service health
echo "1️⃣ Testing service health..."
curl -s "$SERVICE_URL/health" | python3 -m json.tool

echo ""
echo "2️⃣ Testing customer creation via booking..."

# Generate random phone number for testing
RANDOM_PHONE="+1555$(shuf -i 100-999 -n 1)$(shuf -i 1000-9999 -n 1)"

echo "   Using test phone: $RANDOM_PHONE"

# Get a future date (tomorrow)
TOMORROW=$(date -v+1d '+%Y-%m-%d')
START_TIME="${TOMORROW}T14:00:00Z"

echo "   Booking time: $START_TIME"

# Create test booking
RESPONSE=$(curl -s -X POST "$SERVICE_URL/api/bookings" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_first_name\": \"Test\",
    \"customer_last_name\": \"Customer\",
    \"customer_phone\": \"$RANDOM_PHONE\",
    \"customer_email\": \"test.customer+$(date +%s)@k-barbershop.com\",
    \"team_member_id\": \"TMKzhB-WjsDff5rr\",
    \"service_variation_id\": \"7XPUHGDLY4N3H2OWTHMIABKF\",
    \"start_at\": \"$START_TIME\",
    \"customer_note\": \"API Fix Test Booking\"
  }")

echo ""
echo "📋 Response:"
echo "$RESPONSE" | python3 -m json.tool

echo ""
echo "3️⃣ Checking recent error logs..."
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=k-barbershop-backend AND severity>=ERROR AND timestamp>=\"$(date -u -v-5M '+%Y-%m-%dT%H:%M:%SZ')\"" \
  --limit 5 \
  --format json \
  --project website-473417

echo ""
echo "✅ Test complete!"
echo ""
echo "💡 To verify in Square Dashboard:"
echo "   1. Go to: https://squareup.com/dashboard/customers"
echo "   2. Search for: $RANDOM_PHONE"
echo "   3. Check for new customer and booking"
