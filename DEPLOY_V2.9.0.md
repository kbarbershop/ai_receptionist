# Deployment Guide: v2.9.0 Multi-Service Booking

## Quick Deploy Checklist

- [ ] 1. Pull latest code from GitHub
- [ ] 2. Verify version is 2.9.0
- [ ] 3. Deploy backend to Cloud Run
- [ ] 4. Test backend health endpoint
- [ ] 5. Update ElevenLabs system prompt
- [ ] 6. Test AI agent with multi-service scenarios
- [ ] 7. Monitor logs for errors

---

## Detailed Steps

### Step 1: Pull Latest Code

```bash
cd /path/to/ai_receptionist
git pull origin main
```

**Verify you have v2.9.0:**
```bash
cat src/config/constants.js | grep VERSION
# Should output: export const VERSION = '2.9.0';
```

---

### Step 2: Deploy to Google Cloud Run

#### Option A: Manual Deploy (Recommended)

```bash
# Ensure you're in project directory
cd /path/to/ai_receptionist

# Deploy to Cloud Run
gcloud run deploy ai-receptionist \
  --source . \
  --region us-east1 \
  --allow-unauthenticated \
  --set-env-vars SQUARE_ACCESS_TOKEN=$SQUARE_ACCESS_TOKEN,SQUARE_LOCATION_ID=LCS4MXPZP8J3M
```

**Note:** Replace `$SQUARE_ACCESS_TOKEN` with your actual token or ensure it's set as environment variable.

#### Option B: Using Deployment Script

```bash
./deploy.sh
```

---

### Step 3: Test Backend Deployment

#### Health Check

```bash
curl https://your-cloud-run-url.run.app/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "version": "2.9.0",
  "timestamp": "2025-10-12T...",
  "endpoints": [
    "/getCurrentDateTime",
    "/getAvailability",
    "/createBooking",
    "/addServicesToBooking",
    "/rescheduleBooking",
    "/cancelBooking",
    "/lookupBooking",
    "/generalInquiry"
  ]
}
```

**If health check fails:**
1. Check Cloud Run logs: `gcloud run logs read ai-receptionist --limit 50`
2. Verify environment variables are set
3. Check Square API token is valid

#### Test Multi-Service Booking

```bash
curl -X POST https://your-cloud-run-url.run.app/createBooking \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Test User",
    "customerPhone": "5551234567",
    "customerEmail": "test@example.com",
    "startTime": "2025-10-15T14:00:00-04:00",
    "serviceVariationIds": [
      "7XPUHGDLY4N3H2OWTHMIABKF",
      "SPUX6LRBS6RHFBX3MSRASG2J"
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "bookingId": "...",
  "duration_minutes": 60,
  "service_count": 2,
  "services": ["Regular Haircut", "Beard Trim"],
  "message": "Appointment created successfully..."
}
```

---

### Step 4: Update ElevenLabs Agent

#### 4.1 Access ElevenLabs Dashboard

1. Go to https://elevenlabs.io
2. Navigate to your K Barbershop agent
3. Click on "System Prompt" or "Instructions"

#### 4.2 Update System Prompt

**Copy the ENTIRE content from:**
`ELEVENLABS_SYSTEM_PROMPT.md`

**Critical sections to verify are included:**
- Section 2.1: "Booking Multiple Services in One Appointment"
- Critical Rules #16-18 (multi-service rules)
- Enhanced `createBooking` tool documentation

---

### Step 5: Test AI Agent

#### Test Scenario 1: Customer Requests Multiple Services Upfront

**Customer Input:**
> "Hi, I'd like to book a haircut and beard trim for tomorrow at 2pm"

**Expected AI Behavior:**
1. Calls `getCurrentDateTime` to understand "tomorrow"
2. Calls `getAvailability` for 2pm tomorrow
3. Responds: "Perfect! That'll be 60 minutes total for the haircut and beard trim. May I have your name and phone number?"
4. Collects customer info
5. Calls `createBooking` with `serviceVariationIds` array (both services)
6. Confirms: "You're all set for tomorrow at 2pm. See you then!"

**What to Check:**
- ✅ Single appointment created (not two separate ones)
- ✅ AI mentions "60 minutes total"
- ✅ Square dashboard shows 1 booking with 2 services

---

#### Test Scenario 2: Customer Mentions One Service, AI Asks for More

**Customer Input:**
> "I want a haircut tomorrow at 2pm"

**Expected AI Behavior:**
1. Responds: "Great! Would you like to add any other services to your appointment?"
2. Waits for customer response

**Customer Continues:**
> "Yes, add a beard trim"

**Expected AI Behavior:**
3. Proceeds to book BOTH services in ONE appointment
4. Mentions total duration: "That'll be 60 minutes total"
5. Collects info and books

**What to Check:**
- ✅ AI proactively asks about additional services
- ✅ Both services booked in single appointment
- ✅ Customer informed of total duration

---

#### Test Scenario 3: Three Services

**Customer Input:**
> "I need a haircut, beard trim, and eyebrow waxing tomorrow at 3pm"

**Expected AI Behavior:**
1. Checks availability
2. Responds: "Perfect! That'll be 70 minutes total. May I have your name and phone?"
3. Books all three in single appointment

**What to Check:**
- ✅ Correct duration: 30 + 30 + 10 = 70 minutes
- ✅ All three services in one booking
- ✅ AI mentions "70 minutes total"

---

#### Test Scenario 4: Add Service to Existing Appointment

**Customer Input:**
> "I have an appointment tomorrow at 2pm. Can I add a beard trim?"

**Expected AI Behavior:**
1. Verifies identity (phone number)
2. Looks up booking
3. Calls `addServicesToBooking`
4. If no conflict: "Perfect! I've added the beard trim. Your appointment will now take 60 minutes total."
5. If conflict: Explains overlap and offers alternatives

**What to Check:**
- ✅ Identity verified before changes
- ✅ Conflict detection works
- ✅ New total duration communicated

---

### Step 6: Monitor Production

#### Check Cloud Run Logs

```bash
# View real-time logs
gcloud run logs tail ai-receptionist

# View recent errors only
gcloud run logs read ai-receptionist --filter="severity>=ERROR" --limit 50

# View specific booking creation logs
gcloud run logs read ai-receptionist --filter="textPayload:createBooking" --limit 20
```

**Look for:**
- ✅ "Creating booking with X service(s)"
- ✅ "Total appointment duration: X minutes"
- ✅ "Booking created: booking_id with X service(s)"
- ❌ Any error messages or stack traces

#### Monitor Square Dashboard

1. Go to Square Dashboard
2. Navigate to Appointments
3. Check recent bookings

**Verify:**
- Multi-service appointments show all services
- Duration is calculated correctly
- No duplicate appointments for same customer/time

---

## Rollback Plan (If Issues Occur)

### Option 1: Rollback to v2.8.10

```bash
# Checkout previous version
git checkout v2.8.10

# Redeploy
gcloud run deploy ai-receptionist --source .

# Revert ElevenLabs prompt to v2.8.10 version
# (Keep backup of v2.9.0 prompt for future)
```

### Option 2: Quick Fix (Backend Only)

If issue is in backend logic only:

```bash
# Make fixes to src/services/bookingService.js or src/routes/toolsRoutes.js
# Test locally
npm start

# Deploy fix
gcloud run deploy ai-receptionist --source .
```

---

## Common Issues & Solutions

### Issue 1: Agent Creates Separate Appointments

**Symptom:** Customer says "haircut and beard trim", agent creates 2 bookings

**Solution:**
1. Verify ElevenLabs prompt includes section 2.1
2. Check prompt has rule: "ONE appointment, multiple services - NOT separate appointments"
3. Look for prompt instruction: "Use serviceVariationIds array"
4. Test directly: "Book both services in ONE appointment at 2pm"

**Code to verify:**
```javascript
// Check logs show:
console.log(`📋 Creating booking with ${serviceIds.length} service(s)`);
// Should show: "📋 Creating booking with 2 service(s)"
```

---

### Issue 2: Duration Not Communicated

**Symptom:** Agent books correctly but doesn't tell customer total time

**Solution:**
1. Verify backend returns `duration_minutes` in response
2. Check ElevenLabs prompt includes: "System returns duration_minutes - TELL THE CUSTOMER"
3. Add explicit instruction: "Always say: 'That'll be X minutes total'"

**Test response structure:**
```json
{
  "duration_minutes": 60,  // ← Must be present
  "service_count": 2
}
```

---

### Issue 3: Backend Error 400 (Missing Fields)

**Symptom:** `Error: Missing required fields`

**Solution:**
Verify request includes EITHER:
- `serviceVariationId` (single), OR
- `serviceVariationIds` (array)

**Correct requests:**
```json
// Option 1
{"serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF"}

// Option 2
{"serviceVariationIds": ["7XPUHGDLY4N3H2OWTHMIABKF", "SPUX6LRBS6RHFBX3MSRASG2J"]}
```

---

### Issue 4: Square API Error (Invalid Service IDs)

**Symptom:** Square returns error about invalid service variation IDs

**Solution:**
1. Verify service IDs in `src/config/constants.js` match Square
2. Check Square catalog for correct variation IDs
3. Ensure IDs haven't changed in Square dashboard

**Verify IDs:**
```bash
# Check current configuration
cat src/config/constants.js | grep SERVICE_MAPPINGS -A 10
```

---

### Issue 5: Conflict Detection Too Sensitive

**Symptom:** Agent rejects bookings claiming overlap when there's time

**Solution:**
Check overlap detection logic:
```javascript
// In checkForOverlaps():
// Back-to-back is OK: nextStart >= bookingEnd
// Overlap blocked: nextStart < bookingEnd
```

Verify duration calculations are correct in `SERVICE_DURATIONS`.

---

## Post-Deployment Validation

### Checklist: Day 1

- [ ] Monitor first 10 multi-service bookings
- [ ] Verify all bookings appear correctly in Square
- [ ] Check customer confirmation emails (Square auto-send)
- [ ] Review Cloud Run error logs (should be zero)
- [ ] Test edge cases:
  - [ ] Single service (backward compatibility)
  - [ ] Two services
  - [ ] Three services
  - [ ] Adding service to existing booking

### Checklist: Week 1

- [ ] Review booking analytics
  - How many multi-service vs single-service bookings?
  - Average services per booking?
  - Any patterns in service combinations?
- [ ] Gather customer feedback
  - Are they happy with single appointment?
  - Any confusion about total duration?
- [ ] Staff feedback
  - Are appointments properly configured?
  - Any issues with multi-service execution?

---

## Performance Metrics

### Track These KPIs

**Booking Metrics:**
- Total bookings created
- % multi-service bookings (target: >30%)
- Average services per booking (target: 1.3-1.5)
- Most common service combinations

**System Metrics:**
- API response time (target: <2s)
- Error rate (target: <1%)
- Success rate for multi-service bookings (target: >95%)

**Customer Experience:**
- Call duration (should be similar or shorter)
- Customer satisfaction (survey if available)
- Rebooking rate

---

## Success Criteria

✅ **Deployment Successful If:**

1. Backend health check returns v2.9.0
2. Single-service bookings still work (backward compatibility)
3. Multi-service bookings create ONE appointment in Square
4. AI agent mentions total duration to customer
5. Conflict detection prevents overlapping bookings
6. No increase in error rate
7. Customer confirmations sent correctly
8. Staff can see all services in Square dashboard

---

## Support & Escalation

### If Issues Persist:

1. **Check Documentation:**
   - `MULTI_SERVICE_BOOKING.md` - Feature details
   - `TROUBLESHOOTING.md` - Common fixes
   - `CHANGELOG.md` - What changed in v2.9.0

2. **Review Logs:**
   - Cloud Run: `gcloud run logs tail ai-receptionist`
   - Square: Check API error logs in Square dashboard
   - ElevenLabs: Review conversation logs

3. **Test Isolation:**
   - Test backend directly (curl)
   - Test AI prompt separately
   - Test Square API access

4. **Rollback:**
   - If critical issue, rollback to v2.8.10
   - Document issue for future fix
   - Keep v2.9.0 code for debugging

---

## Next Steps After Successful Deployment

1. **Monitor for 24 hours** - Watch for any unexpected behavior
2. **Gather feedback** - From staff and customers
3. **Optimize prompts** - Based on real conversations
4. **Plan analytics** - Track most popular service combinations
5. **Consider enhancements:**
   - Service bundles with discounts
   - Auto-suggest common combinations
   - Dynamic duration based on barber

---

**Deployment Version:** 2.9.0  
**Deployment Date:** October 12, 2025  
**Deployed By:** [Your name]  
**Status:** [ ] Testing [ ] Production [ ] Rolled Back

---

## Quick Reference

### Important URLs
- **Backend:** https://your-cloud-run-url.run.app
- **Health Check:** https://your-cloud-run-url.run.app/health
- **Square Dashboard:** https://squareup.com/dashboard
- **ElevenLabs Dashboard:** https://elevenlabs.io
- **GitHub Repo:** https://github.com/kbarbershop/ai_receptionist

### Important Files
- Backend: `src/services/bookingService.js`
- Routes: `src/routes/toolsRoutes.js`
- Config: `src/config/constants.js`
- Prompt: `ELEVENLABS_SYSTEM_PROMPT.md`
- Docs: `MULTI_SERVICE_BOOKING.md`

### Key Commands
```bash
# Deploy
gcloud run deploy ai-receptionist --source .

# View logs
gcloud run logs tail ai-receptionist

# Test health
curl https://your-url.run.app/health

# Rollback
git checkout v2.8.10 && gcloud run deploy ai-receptionist --source .
```
