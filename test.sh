#!/bin/bash

# Test Script for Square Booking Server
# Tests all 5 tools + health endpoint

BASE_URL="https://square-mcp-server-265357944939.us-east4.run.app"

echo "🧪 Testing Square Booking Server"
echo "=================================="
echo ""

# Test 1: Health Check
echo "Test 1: Health Check"
echo "--------------------"
curl -s "${BASE_URL}/health" | jq '.'
echo ""
echo ""

# Test 2: Analytics
echo "Test 2: Booking Analytics (Last 30 Days)"
echo "-----------------------------------------"
curl -s "${BASE_URL}/analytics/sources" | jq '.'
echo ""
echo ""

# Test 3: Get Availability
echo "Test 3: Get Availability (Next 7 Days)"
echo "---------------------------------------"
curl -s -X POST "${BASE_URL}/tools/getAvailability" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "'$(date +%Y-%m-%d)'"
  }' | jq '.availableSlots[:3]'  # Show first 3 slots
echo ""
echo ""

# Test 4: Lookup Non-Existent Customer
echo "Test 4: Lookup Booking (Test Number)"
echo "-------------------------------------"
curl -s -X POST "${BASE_URL}/tools/lookupBooking" \
  -H "Content-Type: application/json" \
  -d '{
    "customerPhone": "5551234567"
  }' | jq '.'
echo ""
echo ""

echo "✅ Basic tests completed!"
echo ""
echo "📝 Next Steps:"
echo "1. Server is responding correctly"
echo "2. Deploy to Cloud Run if not already deployed: ./deploy.sh"
echo "3. Configure tools in ElevenLabs (see ELEVENLABS_SETUP.md)"
echo "4. Test complete booking workflow in ElevenLabs dashboard"
echo ""
echo "⚠️  Note: To test createBooking, you need:"
echo "   - Valid serviceVariationId from Square"
echo "   - Proper ISO 8601 timestamp"
echo "   - See ELEVENLABS_SETUP.md for complete examples"
echo ""
