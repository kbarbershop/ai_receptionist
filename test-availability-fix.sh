#!/bin/bash

# Test Script for getAvailability Fix
# Tests the new smart availability response

echo "🧪 Testing getAvailability Endpoint"
echo "===================================="
echo ""

# Set your Square MCP server URL
SERVER_URL="https://square-mcp-server-265357944939.us-east4.run.app"

echo "📍 Server: $SERVER_URL"
echo ""

# Test 1: Check if tomorrow at noon is available
echo "Test 1: Check tomorrow at noon with Soon for Regular Haircut"
echo "--------------------------------------------------------------"

curl -X POST "$SERVER_URL/tools/getAvailability" \
  -H "Content-Type: application/json" \
  -d '{
    "datetime": "2025-10-08T12:00:00-04:00",
    "serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF",
    "teamMemberId": "TMKzhB-WjsDff5rr"
  }' | jq '.'

echo ""
echo ""

# Test 2: Check an unavailable time (like 2 AM)
echo "Test 2: Check unavailable time (2:00 AM)"
echo "--------------------------------------------------------------"

curl -X POST "$SERVER_URL/tools/getAvailability" \
  -H "Content-Type: application/json" \
  -d '{
    "datetime": "2025-10-08T02:00:00-04:00",
    "serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF",
    "teamMemberId": "TMKzhB-WjsDff5rr"
  }' | jq '.'

echo ""
echo ""

# Test 3: General availability (no specific time)
echo "Test 3: General availability (no specific time)"
echo "--------------------------------------------------------------"

curl -X POST "$SERVER_URL/tools/getAvailability" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF"
  }' | jq '.'

echo ""
echo ""
echo "✅ Testing complete!"
