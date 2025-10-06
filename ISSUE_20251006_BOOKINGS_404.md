# Issue Summary: Square Bookings API 404 Error

**Date:** October 6, 2025  
**Status:** ✅ RESOLVED  
**Reporter:** Admin via Claude AI Assistant

---

## Problem Description

The Square Bookings API `searchAvailability` endpoint was returning **404 "Service variation not found"** errors when attempting to check booking availability. The deployed ElevenLabs AI receptionist server was unable to search for available appointment times.

### Error Details
```
Status: 404
Error: Service variation not found
Service ID Used: 7XPUHGDLY4N3H2OWTHMJABKF
```

---

## Root Cause

**Typo in Service Variation ID**

The service variation ID being used had a **single character typo**:

- ❌ **Incorrect ID:** `7XPUHGDLY4N3H2OWTHMJABKF` (with **J**)
- ✅ **Correct ID:** `7XPUHGDLY4N3H2OWTHMIABKF` (with **I**)

**Impact:** The incorrect ID (character 19: J instead of I) caused all booking availability searches to fail.

### Why This Happened

The service variation IDs are 25-character alphanumeric strings that are visually similar:
- Position 19: `...OWTHMJABKF` vs `...OWTHMIABKF`
- The characters **J** and **I** are easily confused in certain fonts

The ID was likely transcribed manually at some point and the visual similarity led to the error.

---

## Solution Applied

### 1. Identified All Correct Service Variation IDs

Used Square MCP tools to query the Catalog API and extract all 9 service variation IDs:

```javascript
Square:make_api_request({
  method: "searchObjects",
  service: "catalog",
  request: {
    limit: 100,
    object_types: ["ITEM", "ITEM_VARIATION"],
    include_related_objects: true
  }
})
```

### 2. Verified IDs Work with Bookings API

Tested the correct ID with `searchAvailability`:

```javascript
Square:make_api_request({
  method: "searchAvailability",
  service: "bookings",
  request: {
    query: {
      filter: {
        location_id: "LCS4MXPZP8J3M",
        start_at_range: {
          start_at: "2025-10-07T09:00:00-04:00",
          end_at: "2025-10-08T18:00:00-04:00"
        },
        segment_filters: [{
          service_variation_id: "7XPUHGDLY4N3H2OWTHMIABKF"
        }]
      }
    }
  }
})
```

**Result:** ✅ Returned 69 available time slots successfully

### 3. Created Reference Documentation

Added `SERVICE_VARIATION_IDS.md` to the repository containing:
- All 9 correct service variation IDs
- Service details (price, duration, category)
- Team member IDs
- Usage examples for API calls
- Notes on common mistakes

---

## Files Modified

| File | Action | Description |
|------|--------|-------------|
| `SERVICE_VARIATION_IDS.md` | Created | Complete reference for all service IDs |
| `ISSUE_20251006_BOOKINGS_404.md` | Created | This issue summary document |

**Note:** No code changes were required. The server (`server.js`) dynamically accepts `serviceVariationId` from request body and had no hardcoded IDs.

---

## Verification Steps

### Test 1: Check Availability ✅
```bash
curl -X POST https://square-mcp-server-265357944939.us-east4.run.app/tools/getAvailability \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-10-07",
    "serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF"
  }'
```
**Expected:** Returns array of available time slots  
**Status:** ✅ PASS

### Test 2: General Inquiry ✅
```bash
curl -X POST https://square-mcp-server-265357944939.us-east4.run.app/tools/generalInquiry \
  -H "Content-Type: application/json" \
  -d '{"inquiryType": "services"}'
```
**Expected:** Returns all 9 services with correct IDs  
**Status:** ✅ PASS

### Test 3: All Other Booking Tools
Once the correct service variation IDs are used in ElevenLabs configuration:
- `createBooking` - ⏳ Ready to test
- `rescheduleBooking` - ⏳ Ready to test
- `cancelBooking` - ⏳ Ready to test
- `lookupBooking` - ⏳ Ready to test

---

## Next Steps for Deployment

### 1. Update ElevenLabs Agent Configuration

In ElevenLabs dashboard, update the tool examples with correct service variation IDs:

**Example for getAvailability tool:**
```json
{
  "startDate": "2025-10-07",
  "serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF"
}
```

**Example for createBooking tool:**
```json
{
  "customerName": "John Doe",
  "customerPhone": "555-0123",
  "startTime": "2025-10-07T14:00:00Z",
  "serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF",
  "teamMemberId": "TMeze5z5YYPIgXCe"
}
```

### 2. Update System Prompt (Optional)

Add service ID reference to system prompt so the AI knows which IDs to use:

```
Available Services:
- Regular Haircut: 7XPUHGDLY4N3H2OWTHMIABKF ($35, 30min)
- Beard Trim: SPUX6LRBS6RHFBX3MSRASG2J ($25, 30min)
- Beard Sculpt: UH5JRVCJGAB2KISNBQ7KMVVQ ($30, 30min)
[... etc]
```

### 3. Test All 6 Booking Tools

Run comprehensive tests of:
1. generalInquiry → Get all services/hours/staff ✅
2. getAvailability → Check time slots ✅
3. createBooking → Make a test booking ⏳
4. lookupBooking → Find customer bookings ⏳
5. rescheduleBooking → Change appointment time ⏳
6. cancelBooking → Cancel appointment ⏳

---

## Prevention Measures

### 1. Use Dynamic ID Retrieval
The `generalInquiry` tool returns all service IDs dynamically from Square. Use this instead of hardcoded IDs whenever possible.

### 2. Reference Documentation
Always refer to `SERVICE_VARIATION_IDS.md` when configuring tools or testing APIs.

### 3. Copy-Paste, Don't Transcribe
When working with Square IDs:
- ✅ Copy directly from Square Dashboard or API responses
- ✅ Copy from `SERVICE_VARIATION_IDS.md`
- ❌ Never manually type IDs

### 4. Test After Configuration Changes
After updating any service variation IDs:
```bash
# Quick test
curl -X POST https://square-mcp-server-265357944939.us-east4.run.app/tools/getAvailability \
  -H "Content-Type: application/json" \
  -d '{"serviceVariationId": "YOUR_ID_HERE"}'
```

---

## Key Learnings

1. **Visual Similarity Is Dangerous:** Characters like I/J, O/0, 1/l in IDs can cause subtle bugs
2. **Square Has Two ID Types:** 
   - ITEM IDs (parent) - DON'T use for bookings
   - ITEM_VARIATION IDs (child) - USE for bookings
3. **Server Code Was Fine:** The bug was in the data being passed, not the code
4. **Dynamic Is Better:** Pulling IDs from `generalInquiry` tool is more reliable than hardcoding

---

## Related Documentation

- `SERVICE_VARIATION_IDS.md` - Complete ID reference
- `ELEVENLABS_TOOL_CONFIGS.md` - Tool configuration guide
- `server.js` - Server implementation
- Square API Docs: https://developer.squareup.com/docs/bookings-api

---

**Issue Closed:** October 6, 2025  
**Total Resolution Time:** ~30 minutes  
**Tools Used:** Square MCP, GitHub MCP, Claude AI debugging
