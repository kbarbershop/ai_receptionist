# Fix: ElevenLabs Agent Booking Failures

**Date:** October 6, 2025  
**Status:** 🔧 IN PROGRESS  
**Issue:** ElevenLabs AI agent fails to return correct availability and cannot book appointments for tomorrow

---

## Problem Summary

The ElevenLabs AI receptionist is experiencing two critical issues:

1. **❌ Incorrect Available Slots:** When customer asks for tomorrow's availability, agent returns wrong or no slots
2. **❌ Booking Failures:** Cannot complete bookings even when slots appear available

---

## Root Cause Analysis

### Issue 1: Service Variation ID Confusion

**Problem:** The agent might not be using the correct service variation IDs when calling booking tools.

**Evidence:**
- Previous 404 error with typo in service ID (`7XPUHGDLY4N3H2OWTHMJABKF` vs `7XPUHGDLY4N3H2OWTHMIABKF`)
- System prompt shows correct IDs, but agent execution may differ

**Impact:** Availability searches fail or return empty results

### Issue 2: Timezone/Date Handling

**Problem:** When customer says "tomorrow", the agent must convert it to proper ISO 8601 format with timezone offset.

**Required Format:** `2025-10-07T14:00:00-04:00` (EDT) or `2025-10-07T14:00:00Z` (UTC)

**Common Mistakes:**
- ❌ Missing timezone offset: `2025-10-07T14:00:00`
- ❌ Wrong date: Using today's date instead of tomorrow
- ❌ Wrong timezone: Using UTC when EST/EDT required

### Issue 3: Tool Response Interpretation

**Problem:** The agent may not be correctly interpreting the availability response structure.

**Expected Response Structure:**
```json
{
  "success": true,
  "availableSlots": [
    {
      "start_at": "2025-10-07T14:00:00Z",
      "location_id": "LCS4MXPZP8J3M",
      "appointment_segments": [
        {
          "duration_minutes": 30,
          "team_member_id": "TMKzhB-WjsDff5rr",
          "service_variation_id": "7XPUHGDLY4N3H2OWTHMIABKF",
          "service_variation_version": 1759409664884
        }
      ]
    }
  ]
}
```

---

## Solution

### Step 1: Verify Server Health ✅

Test the Square MCP server endpoints:

```bash
# Health check
curl https://square-mcp-server-265357944939.us-east4.run.app/health

# Test availability endpoint
curl -X POST https://square-mcp-server-265357944939.us-east4.run.app/tools/getAvailability \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-10-07",
    "serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF"
  }'
```

**Status:** ✅ Server working correctly (tested via Square MCP)

### Step 2: Update ElevenLabs Tool Configurations

#### Tool: getAvailability

**Current Issue:** May not have clear examples for the LLM

**Fix:** Update tool description and examples in ElevenLabs dashboard:

```json
{
  "name": "checkAvailability",
  "description": "Check available appointment slots for K Barbershop. IMPORTANT: Always include both startDate and serviceVariationId. The serviceVariationId must match exactly from the Available Services list. Returns time slots for the next 7 days starting from startDate.",
  "request_body_schema": {
    "properties": [
      {
        "id": "startDate",
        "type": "string",
        "description": "Start date in YYYY-MM-DD format (e.g., '2025-10-07' for October 7, 2025). When customer says 'tomorrow', calculate tomorrow's date. Required field.",
        "required": true,
        "value_type": "llm_prompt"
      },
      {
        "id": "serviceVariationId",
        "type": "string",
        "description": "The exact service variation ID from Available Services list. REQUIRED. Must be one of: 7XPUHGDLY4N3H2OWTHMIABKF (Regular Haircut), SPUX6LRBS6RHFBX3MSRASG2J (Beard Trim), UH5JRVCJGAB2KISNBQ7KMVVQ (Beard Sculpt), etc. Copy ID exactly, do not modify.",
        "required": true,
        "value_type": "llm_prompt",
        "enum": [
          "7XPUHGDLY4N3H2OWTHMIABKF",
          "SPUX6LRBS6RHFBX3MSRASG2J",
          "UH5JRVCJGAB2KISNBQ7KMVVQ",
          "ALZZEN4DO6JCNMC6YPXN6DPH",
          "VVGK7I7L6BHTG7LFKLAIRHBZ",
          "3TV5CVRXCB62BWIWVY6OCXIC",
          "7ND6OIFTRLJEPMDBBI3B3ELT",
          "7UKWUIF4CP7YR27FI52DWPEN",
          "7PFUQVFMALHIPDAJSYCBKBYV"
        ]
      }
    ]
  }
}
```

#### Tool: createBooking

**Fix:** Ensure timezone is properly handled in startTime parameter

```json
{
  "id": "startTime",
  "type": "string",
  "description": "Start time in ISO 8601 format with timezone. MUST be in UTC format ending with Z (e.g., '2025-10-07T14:00:00Z' for 2pm UTC, which is 10am EDT). Convert customer's requested time to UTC before sending. Required field.",
  "required": true,
  "value_type": "llm_prompt"
}
```

### Step 3: Enhance System Prompt

**Add explicit instructions for date/time handling:**

```markdown
## Date & Time Handling (CRITICAL)

### Converting Customer Requests to API Format

When customer says:
- **"tomorrow"** → Calculate date as: current date + 1 day → Format as YYYY-MM-DD
- **"next Monday"** → Find next Monday's date → Format as YYYY-MM-DD  
- **"2pm"** → Convert to UTC: 2pm EDT = 18:00 UTC → Format as "2025-10-07T18:00:00Z"

### API Call Examples

**Customer: "Can I get a haircut tomorrow at 2pm?"**

1. Calculate tomorrow's date: Today is Oct 6, so tomorrow is Oct 7 = "2025-10-07"
2. Get service ID: "haircut" = "7XPUHGDLY4N3H2OWTHMIABKF"
3. Call checkAvailability:
```json
{
  "startDate": "2025-10-07",
  "serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF"
}
```

4. If 2pm EDT (18:00 UTC) is in response, convert to human format: "2pm"
5. Confirm with customer: "I have 2pm available tomorrow"

**CRITICAL:** Always check availability BEFORE offering times to customer

### Service ID Quick Reference

**Most Common Services:**
- Haircut: `7XPUHGDLY4N3H2OWTHMIABKF`
- Beard Trim: `SPUX6LRBS6RHFBX3MSRASG2J`
- Beard Sculpt: `UH5JRVCJGAB2KISNBQ7KMVVQ`

**When in doubt:** Use generalInquiry tool to get current service list
```

### Step 4: Test Comprehensive Booking Flow

**Test Case 1: Tomorrow at 2pm**

```
Customer: "I need a haircut tomorrow at 2pm"
Agent should:
1. Calculate tomorrow = 2025-10-07
2. Call checkAvailability with:
   - startDate: "2025-10-07"
   - serviceVariationId: "7XPUHGDLY4N3H2OWTHMIABKF"
3. Search response for 18:00:00Z (2pm EDT)
4. If available, proceed to book
5. If not available, offer nearby times

Expected: Agent finds 2pm slot and books successfully
```

**Test Case 2: Any time tomorrow**

```
Customer: "What times are available tomorrow for a haircut?"
Agent should:
1. Calculate tomorrow = 2025-10-07
2. Call checkAvailability with:
   - startDate: "2025-10-07"
   - serviceVariationId: "7XPUHGDLY4N3H2OWTHMIABKF"
3. List first 3-5 available times in human format
4. Ask customer which time works

Expected: Agent lists "10am, 10:15am, 10:30am..." etc.
```

### Step 5: Add Debugging to Server (Optional)

Add request logging to track what ElevenLabs is sending:

```javascript
// In server.js, add at top of each endpoint:
app.post('/tools/getAvailability', async (req, res) => {
  console.log('🔍 getAvailability called:', JSON.stringify(req.body, null, 2));
  // ... rest of code
});
```

---

## Verification Checklist

### Server Health ✅
- [ ] Server responds to `/health` endpoint
- [ ] Server returns 9 services from `/tools/generalInquiry`
- [ ] Server returns availability for tomorrow

### Tool Configuration
- [ ] checkAvailability tool has enum with all 9 service IDs
- [ ] createBooking tool has clear timezone instructions
- [ ] All required fields marked as required

### System Prompt
- [ ] Contains date/time conversion examples
- [ ] Lists all 9 service variation IDs with names
- [ ] Includes step-by-step booking flow examples

### End-to-End Test
- [ ] Ask "What times are available tomorrow?" → Agent lists times
- [ ] Ask "Book me for 2pm tomorrow" → Agent books successfully
- [ ] Ask "How much is a haircut?" → Agent responds with $35

---

## Expected Timeline

1. **Update tool configurations:** 10 minutes
2. **Update system prompt:** 5 minutes
3. **Test with ElevenLabs:** 15 minutes
4. **Debug issues:** 30 minutes
5. **Final verification:** 10 minutes

**Total:** ~70 minutes

---

## Monitoring & Rollback

### Monitor These Metrics
- Booking success rate
- Tool call errors in ElevenLabs logs
- Customer complaints about "no availability"

### Rollback Plan
If issues persist:
1. Check ElevenLabs conversation logs for exact tool calls
2. Verify tool request payloads match expected format
3. Test server endpoints directly with curl
4. Review Cloud Run logs for errors

---

## Next Steps

1. **Immediately:** Update ElevenLabs tool configurations with enum values
2. **Within 1 hour:** Test booking flow with real phone calls
3. **Monitor:** Watch for errors over next 24 hours
4. **Document:** Add successful test cases to this file

---

## Related Files

- `ELEVENLABS_SYSTEM_PROMPT.md` - System prompt (update with date handling)
- `ELEVENLABS_TOOL_CONFIGS.md` - Tool JSON configs (update with enum)
- `SERVICE_VARIATION_IDS.md` - Reference for all service IDs
- `server.js` - Server code (add logging if needed)

---

**Status:** Ready for deployment  
**Priority:** 🔴 HIGH - Customer experience impacted  
**Owner:** Admin
