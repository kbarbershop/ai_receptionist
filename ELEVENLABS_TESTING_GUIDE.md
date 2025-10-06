# ElevenLabs Agent Configuration & Testing Guide

**Date:** October 6, 2025  
**Purpose:** Fix service variation ID errors and test end-to-end booking flow

---

## 🚨 CRITICAL ISSUE IDENTIFIED

**Problem:** ElevenLabs agent is using INCORRECT service variation IDs, causing all booking attempts to fail with "Service variation not found" errors.

**Evidence from conversation logs:**
- "I'm seeing an error checking availability right now"
- "I'm having trouble accessing availability right now"

**Root Cause:** Agent configuration has typo in service variation ID:
- ❌ Wrong: `7XPUHGDLY4N3H2OWTHMJABKF` (with **J**)
- ✅ Right: `7XPUHGDLY4N3H2OWTHMIABKF` (with **I**)

---

## ✅ STEP 1: Update ElevenLabs Agent Configuration

### 1.1 Update System Prompt

1. Go to ElevenLabs Dashboard → Your Agent → **Agent** tab
2. Find **System Prompt** section
3. Replace with the content from: `ELEVENLABS_SYSTEM_PROMPT.md`
4. **Key changes:**
   - Added all 9 correct service variation IDs
   - Added team member IDs
   - Removed waitlist/callback/hold language
   - Added "NO WAITLISTS, CALLBACKS, OR HOLDS" to critical rules

### 1.2 Update Tool Configurations

Go to **Tools** tab and update each tool:

#### Tool: checkAvailability (getAvailability)

**Current (BROKEN):**
```json
{
  "serviceVariationId": "7XPUHGDLY4N3H2OWTHMJABKF"
}
```

**Fixed:**
```json
{
  "serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF"
}
```

**All Service Variation IDs:**
- Regular Haircut: `7XPUHGDLY4N3H2OWTHMIABKF`
- Beard Trim: `SPUX6LRBS6RHFBX3MSRASG2J`
- Beard Sculpt: `UH5JRVCJGAB2KISNBQ7KMVVQ`
- Ear Waxing: `ALZZEN4DO6JCNMC6YPXN6DPH`
- Nose Waxing: `VVGK7I7L6BHTG7LFKLAIRHBZ`
- Eyebrow Waxing: `3TV5CVRXCB62BWIWVY6OCXIC`
- Paraffin: `7ND6OIFTRLJEPMDBBI3B3ELT`
- Gold Package: `7UKWUIF4CP7YR27FI52DWPEN`
- Silver Package: `7PFUQVFMALHIPDAJSYCBKBYV`

#### Tool: createBooking

**Update example requests to use correct IDs:**
```json
{
  "customerName": "John Doe",
  "customerPhone": "+15551234567",
  "startTime": "2025-10-07T14:00:00Z",
  "serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF",
  "teamMemberId": "TMeze5z5YYPIgXCe"
}
```

---

## ✅ STEP 2: Verify Server is Running

Check server health:

```bash
curl https://square-mcp-server-265357944939.us-east4.run.app/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "service": "Square Booking Server for ElevenLabs",
  "version": "2.2.2",
  "endpoints": {
    "serverTools": [
      "POST /tools/getAvailability",
      "POST /tools/createBooking",
      "POST /tools/rescheduleBooking",
      "POST /tools/cancelBooking",
      "POST /tools/lookupBooking",
      "POST /tools/generalInquiry"
    ]
  }
}
```

---

## ✅ STEP 3: Test Each Tool via Server (Before Testing Agent)

### Test 1: generalInquiry
```bash
curl -X POST https://square-mcp-server-265357944939.us-east4.run.app/tools/generalInquiry \
  -H "Content-Type: application/json" \
  -d '{"inquiryType": "services"}'
```

**Expected:** Returns all 9 services with correct IDs

---

### Test 2: getAvailability (CRITICAL - This was failing)
```bash
curl -X POST https://square-mcp-server-265357944939.us-east4.run.app/tools/getAvailability \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-10-07",
    "serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF"
  }'
```

**Expected:** Returns array of available time slots  
**If it fails:** You're using the wrong service variation ID

---

### Test 3: createBooking (Use Test Phone Number)
```bash
curl -X POST https://square-mcp-server-265357944939.us-east4.run.app/tools/createBooking \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Test User",
    "customerPhone": "+15555551234",
    "customerEmail": "test@example.com",
    "startTime": "2025-10-07T16:00:00Z",
    "serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF",
    "teamMemberId": "TMeze5z5YYPIgXCe"
  }'
```

**Expected:** Returns booking ID and confirmation

---

### Test 4: lookupBooking
```bash
curl -X POST https://square-mcp-server-265357944939.us-east4.run.app/tools/lookupBooking \
  -H "Content-Type: application/json" \
  -d '{
    "customerPhone": "+15555551234"
  }'
```

**Expected:** Returns the booking we just created

---

### Test 5: rescheduleBooking
```bash
curl -X POST https://square-mcp-server-265357944939.us-east4.run.app/tools/rescheduleBooking \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "BOOKING_ID_FROM_TEST_3",
    "newStartTime": "2025-10-07T17:00:00Z"
  }'
```

**Expected:** Booking time changes to 5pm

---

### Test 6: cancelBooking
```bash
curl -X POST https://square-mcp-server-265357944939.us-east4.run.app/tools/cancelBooking \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "BOOKING_ID_FROM_TEST_3"
  }'
```

**Expected:** Booking status changes to CANCELLED

---

## ✅ STEP 4: Test End-to-End via ElevenLabs Agent

### Test Scenario 1: Book New Appointment

**Call the agent and say:**
> "I'd like to book a haircut for tomorrow at 2pm"

**What Should Happen:**
1. Agent uses `getAvailability` with correct service ID
2. Agent confirms time is available
3. Agent asks for name and phone number
4. Agent confirms details
5. Agent uses `createBooking` to create appointment
6. Agent confirms booking

**What Was Happening Before (BROKEN):**
- Agent tries to check availability
- Gets 404 error from Square
- Says "I'm seeing an error checking availability right now"

---

### Test Scenario 2: Ask About Services
**Say:**
> "How much is a haircut?"

**What Should Happen:**
1. Agent uses `generalInquiry` with `inquiryType: "services"`
2. Agent responds: "Our haircut is $35 and takes about 30 minutes"

---

### Test Scenario 3: Ask About Hours
**Say:**
> "What time do you close today?"

**What Should Happen:**
1. Agent uses `generalInquiry` with `inquiryType: "hours"`
2. Agent responds with actual closing time from Square

---

### Test Scenario 4: Reschedule Appointment
**Say:**
> "I need to reschedule my appointment"

**What Should Happen:**
1. Agent asks for phone number
2. Agent uses `lookupBooking`
3. Agent shows current booking
4. Agent asks for new time
5. Agent uses `getAvailability` to check new time
6. Agent uses `rescheduleBooking` to update
7. Agent confirms new time

---

### Test Scenario 5: Cancel Appointment
**Say:**
> "I need to cancel my appointment"

**What Should Happen:**
1. Agent verifies identity (phone number)
2. Agent uses `lookupBooking`
3. Agent asks for confirmation
4. Agent uses `cancelBooking`
5. Agent confirms cancellation

---

## ✅ STEP 5: Test Waitlist/Callback Blocking

### Test Scenario 6: No Availability
**Say:**
> "Can I get a haircut at midnight?"

**What Should NOT Happen:**
- ❌ "Let me add you to our waitlist"
- ❌ "I'll call you back when something opens up"
- ❌ "Can I hold that time for you?"

**What SHOULD Happen:**
- ✅ "I don't have midnight available. I have openings at [list times]. Would any of those work?"

---

## 🔍 Monitoring & Debugging

### Check Conversation Logs

After each test call:
1. Go to ElevenLabs Dashboard → **Conversations**
2. Find your test call
3. Review transcript
4. Check for errors

**Look for:**
- ✅ Agent successfully calls tools
- ✅ No "error checking availability" messages
- ✅ Bookings are created successfully
- ❌ Any 404 errors
- ❌ Any "service variation not found" errors

---

### Check Square Dashboard

1. Go to Square Dashboard → **Appointments**
2. Look for test bookings
3. Verify:
   - Customer name matches
   - Time is correct
   - Service is correct
   - Status is ACCEPTED (for new bookings)

---

## 📊 Test Checklist

- [ ] Updated system prompt in ElevenLabs
- [ ] Updated tool configurations with correct service IDs
- [ ] Verified server health endpoint
- [ ] Tested all 6 server endpoints directly
- [ ] Made test call: Book new appointment
- [ ] Made test call: Ask about services
- [ ] Made test call: Ask about hours
- [ ] Made test call: Reschedule appointment
- [ ] Made test call: Cancel appointment
- [ ] Made test call: Test no-availability response (no waitlist offered)
- [ ] Verified bookings appear in Square Dashboard
- [ ] Checked conversation logs for errors

---

## 🚨 Troubleshooting

### Issue: Still getting "Service variation not found"
**Solution:** 
1. Double-check service variation ID in tool config
2. Make sure it's `7XPUHGDLY4N3H2OWTHMIABKF` (with **I**, not J)
3. Test directly via curl first

### Issue: Agent not calling tools
**Solution:**
1. Check system prompt mentions tool names correctly
2. Verify tool descriptions are clear
3. Check ElevenLabs tool configuration is saved

### Issue: Bookings not appearing in Square
**Solution:**
1. Check server logs in Google Cloud Run
2. Verify Square API token is valid
3. Test createBooking endpoint directly via curl

### Issue: Agent offering waitlist/callbacks
**Solution:**
1. Update system prompt with NO WAITLISTS section
2. Add explicit instructions in critical rules
3. Test with scenarios where time isn't available

---

## 📝 Success Criteria

**All tests pass when:**
1. ✅ Agent can check availability without errors
2. ✅ Agent can create bookings successfully
3. ✅ Bookings appear in Square Dashboard immediately
4. ✅ Agent can lookup existing bookings
5. ✅ Agent can reschedule bookings
6. ✅ Agent can cancel bookings
7. ✅ Agent NEVER offers waitlists, callbacks, or holds
8. ✅ All service information comes from `generalInquiry` tool

---

**Once all tests pass, your ElevenLabs AI receptionist is production-ready!** 🎉
