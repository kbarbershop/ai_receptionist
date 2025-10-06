# ElevenLabs Integration Setup Guide

**Last Updated:** October 6, 2025  
**Server:** https://square-mcp-server-265357944939.us-east4.run.app

---

## 📋 Prerequisites

✅ Server deployed to Google Cloud Run  
✅ Test script passed (health check working)  
✅ Square API credentials configured

---

## 🎯 Setup Overview

1. **Copy System Prompt** → Agent settings
2. **Add 5 Tools** → Copy JSON configs
3. **Test Agent** → Verify each workflow

**Estimated Time:** 15 minutes

---

## Step 1: Configure System Prompt (5 min)

### Open Your Agent Settings
1. Go to **ElevenLabs Dashboard**
2. Select your AI receptionist agent
3. Navigate to **Agent** section → **System Prompt**

### Copy the System Prompt
The complete system prompt is in: **[ELEVENLABS_SYSTEM_PROMPT.md](ELEVENLABS_SYSTEM_PROMPT.md)**

**Or copy from here:**

```
You are the AI receptionist for K Barbershop in Great Falls, Virginia.

[See ELEVENLABS_SYSTEM_PROMPT.md for full prompt - 8.5KB]
```

**Key sections included:**
- ✅ Timezone handling (America/New_York with EST/EDT)
- ✅ Personality guidelines (friendly, concise, professional)
- ✅ Appointment workflows (book, reschedule, cancel)
- ✅ Tool usage instructions
- ✅ Guardrails and rules
- ✅ Response templates

**Paste the entire system prompt into ElevenLabs.**

---

## Step 2: Add 5 Tools (8 min)

### Tool Configuration Format
All tool JSON configs are in: **[ELEVENLABS_TOOL_CONFIGS.md](ELEVENLABS_TOOL_CONFIGS.md)**

### How to Add Each Tool

1. In Agent settings → **Tools** section
2. Click **"Add Tool"**
3. Select **"Webhook"** as Tool Type
4. **Copy JSON from ELEVENLABS_TOOL_CONFIGS.md**
5. Paste into ElevenLabs (it should auto-populate fields)
6. Click **Save**
7. Repeat for all 5 tools

---

### Tool 1: checkAvailability ✅
**Purpose:** Check available appointment slots (7-day window)

**JSON Config:** See [ELEVENLABS_TOOL_CONFIGS.md](ELEVENLABS_TOOL_CONFIGS.md#tool-1-check-availability)

**Parameters:**
- `startDate` (optional): YYYY-MM-DD format
- `serviceVariationId` (optional): Specific service

---

### Tool 2: createBooking ✅
**Purpose:** Create new appointments

**JSON Config:** See [ELEVENLABS_TOOL_CONFIGS.md](ELEVENLABS_TOOL_CONFIGS.md#tool-2-create-booking)

**Parameters:**
- `customerName` (required): Full name
- `customerPhone` (required): 10-digit phone
- `customerEmail` (optional): Email address
- `startTime` (required): ISO 8601 with timezone
- `serviceVariationId` (required): From availability
- `teamMemberId` (optional): Specific barber

**Critical:** `startTime` MUST include UTC offset:
- `2025-10-15T14:00:00-04:00` (EDT)
- `2025-10-15T14:00:00-05:00` (EST)

---

### Tool 3: lookupBooking ✅
**Purpose:** Find bookings by phone number

**JSON Config:** See [ELEVENLABS_TOOL_CONFIGS.md](ELEVENLABS_TOOL_CONFIGS.md#tool-3-lookup-booking)

**Parameters:**
- `customerPhone` (required): 10-digit phone
- `customerName` (optional): For verification

---

### Tool 4: rescheduleBooking ✅
**Purpose:** Change appointment time

**JSON Config:** See [ELEVENLABS_TOOL_CONFIGS.md](ELEVENLABS_TOOL_CONFIGS.md#tool-4-reschedule-booking)

**Parameters:**
- `bookingId` (required): From lookupBooking
- `newStartTime` (required): ISO 8601 with timezone

---

### Tool 5: cancelBooking ✅
**Purpose:** Cancel appointments

**JSON Config:** See [ELEVENLABS_TOOL_CONFIGS.md](ELEVENLABS_TOOL_CONFIGS.md#tool-5-cancel-booking)

**Parameters:**
- `bookingId` (required): From lookupBooking

---

## Step 3: Test Your Agent (2 min)

### Test in ElevenLabs Dashboard

**Test 1: Check Availability**
- Say: *"What time slots do you have available tomorrow?"*
- ✅ Agent should call `checkAvailability`
- ✅ Agent should list available times

**Test 2: Create Booking**
- Say: *"I'd like to book a haircut for tomorrow at 2pm. My name is John Smith, phone 555-0123"*
- ✅ Agent should check availability first
- ✅ Agent should confirm details
- ✅ Agent should call `createBooking`
- ✅ Should see booking in Square Dashboard

**Test 3: Lookup Booking**
- Say: *"I need to check my appointment. My phone is 555-0123"*
- ✅ Agent should call `lookupBooking`
- ✅ Agent should read back appointment details

**Test 4: Reschedule**
- Say: *"Can I move my appointment to Thursday at 3pm?"*
- ✅ Agent should lookup current appointment
- ✅ Agent should check new availability
- ✅ Agent should confirm change
- ✅ Agent should call `rescheduleBooking`

**Test 5: Cancel**
- Say: *"I need to cancel my appointment"*
- ✅ Agent should lookup appointment
- ✅ Agent should confirm cancellation
- ✅ Agent should call `cancelBooking`

---

## 📊 Verify in Square Dashboard

After testing, check Square Dashboard:
1. Go to **Appointments** tab
2. Look for test bookings
3. Check customer notes: Should say **"Phone Booking (ElevenLabs AI)"**
4. Verify all changes (reschedules/cancels) worked

---

## 🔍 Troubleshooting

### Agent Not Calling Tools

**Issue:** Agent responds but doesn't use tools

**Fix:**
1. Check tool names match exactly (case-sensitive)
2. Verify tool descriptions are clear
3. Update system prompt with more specific tool usage instructions
4. Test with simpler queries first

---

### Tool Returns Error

**Issue:** Tool is called but returns 400/500 error

**Check:**
1. Server is running:
   ```bash
   curl https://square-mcp-server-265357944939.us-east4.run.app/health
   ```

2. Parameter format (especially `startTime`):
   - ❌ Wrong: `2025-10-15T14:00:00`
   - ✅ Right: `2025-10-15T14:00:00-04:00`

3. Cloud Run logs:
   ```bash
   gcloud run logs read square-mcp-server --region us-east4 --limit 50
   ```

---

### Wrong Data Being Sent

**Issue:** Tool is called with incorrect parameters

**Fix:**
1. Review tool description in JSON config
2. Make parameter descriptions more specific
3. Add examples in parameter descriptions
4. Update system prompt with parameter format examples

---

### Timezone Issues

**Issue:** Appointments created at wrong time

**Fix:**
- System prompt specifies: **America/New_York (EST/EDT)**
- All times MUST include UTC offset:
  - EST (Nov-Mar): `-05:00`
  - EDT (Mar-Nov): `-04:00`
- Update system prompt if needed

---

## 📚 Additional Resources

- **System Prompt:** [ELEVENLABS_SYSTEM_PROMPT.md](ELEVENLABS_SYSTEM_PROMPT.md)
- **Tool Configs:** [ELEVENLABS_TOOL_CONFIGS.md](ELEVENLABS_TOOL_CONFIGS.md)
- **Server README:** [README.md](README.md)
- **Quick Reference:** [QUICKREF.md](QUICKREF.md)

---

## 🆘 Need Help?

**Server Issues:**
```bash
# Check server health
curl https://square-mcp-server-265357944939.us-east4.run.app/health

# View logs
gcloud run logs read square-mcp-server --region us-east4

# Test endpoint directly
curl -X POST https://square-mcp-server-265357944939.us-east4.run.app/tools/getAvailability \
  -H "Content-Type: application/json" \
  -d '{"startDate": "2025-10-15"}'
```

**ElevenLabs Issues:**
- Check ElevenLabs documentation: https://elevenlabs.io/docs/conversational-ai
- Test tools individually in ElevenLabs dashboard
- Verify webhook URLs are correct
- Check for typos in JSON configs

---

## ✅ Success Checklist

- [ ] System prompt configured
- [ ] All 5 tools added and saved
- [ ] Tested availability check
- [ ] Tested booking creation
- [ ] Tested lookup
- [ ] Tested rescheduling
- [ ] Tested cancellation
- [ ] Verified in Square Dashboard
- [ ] Phone bookings tagged correctly

---

## 📈 Next Steps

Once everything works:

1. **Monitor Analytics:**
   ```bash
   curl https://square-mcp-server-265357944939.us-east4.run.app/analytics/sources
   ```

2. **Review Call Logs** in ElevenLabs to improve system prompt

3. **Update Business Hours** when needed (system will pull from Square)

4. **Add Knowledge Base** - Upload SOP document to ElevenLabs for additional context

---

**Your AI receptionist is now live and ready to book appointments! 🎉**
