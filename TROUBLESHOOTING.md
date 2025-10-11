# Troubleshooting Guide

## Overview
This guide consolidates key lessons learned from debugging the AI Receptionist system. Historical fix documentation has been archived to `/archive` folder for reference.

---

## Critical Issues & Solutions

### 1. Phone Number Format Issues

**Problem:** Square API has different requirements for search vs create operations.

**Solution:**
- **Search/Lookup**: Use E.164 format WITH + prefix: `+15715276016`
- **Create Customer**: Use 10 digits WITHOUT +1: `5715276016`
- **Normalization**: Use `normalizePhoneNumber()` helper function

```javascript
// Search: +15715276016
// Create: 5715276016
```

**Files Archived:**
- `FIX_PHONE_FORMAT_20251006.md`
- `FIX_PHONE_NUMBER_20251006.md`

---

### 2. Field Naming Convention

**Problem:** Square Customer API requires snake_case, NOT camelCase. Using camelCase causes 400 errors.

**Solution:**
```javascript
// ✅ CORRECT
{
  phone_number: "+15715276016",
  given_name: "John",
  family_name: "Doe",
  email_address: "john@example.com"
}

// ❌ WRONG
{
  phoneNumber: "+15715276016",
  givenName: "John",
  familyName: "Doe",
  emailAddress: "john@example.com"
}
```

**Files Archived:**
- `CRITICAL_FIX_SQUARE_CUSTOMER_API.md`

---

### 3. BigInt Serialization Errors

**Problem:** Square API returns BigInt values that can't be JSON serialized.

**Solution:** Use `sanitizeBigInts()` helper to convert BigInt to strings before JSON.stringify():

```javascript
const sanitizedResponse = sanitizeBigInts(booking);
res.json({ success: true, data: sanitizedResponse });
```

**Files Archived:**
- `FIX_BIGINT_SERIALIZATION_20251006.md`

---

### 4. Timezone Handling

**Problem:** Missing or incorrect timezone offsets cause booking failures.

**Solution:**
- Always use `America/New_York` timezone
- Validate and auto-correct timezone offsets
- Convert EDT ↔ UTC for Square API calls
- Display times with explicit month names: "Thu, Oct 10, 2025 2:00 PM EDT"

```javascript
// Auto-correction logic in datetime.js
if (!startTime.includes('T') || !startTime.includes('-04:00')) {
  // Add timezone
}
```

**Files Archived:**
- `DEPLOYMENT_TIME_FIX.md`

---

### 5. Booking Availability Conflicts

**Problem:** Cancelled bookings were blocking availability checks.

**Solution:**
- Filter out bookings with `status === 'CANCELLED'`
- Allow back-to-back bookings (same end/start time)
- Prevent overlapping appointments
- Use 1-minute tolerance for time matching

```javascript
const activeBookings = bookings.filter(b => b.status !== 'CANCELLED');
```

**Files Archived:**
- `FIX_DATE_TIME_MATCHING_20251007.md`
- `FIX_ADD_SERVICES_CONSECUTIVE_BOOKINGS.md`
- `FIX_AVAILABILITY_RESPONSE_20251007.md`

---

### 6. Adding Services to Existing Bookings

**Problem:** Adding services could create overlapping appointments.

**Solution:**
- Check for conflicts before adding services
- Calculate total duration including new services
- Validate no overlaps with other bookings
- Return clear error messages if conflicts exist

**Files Archived:**
- `FIX_ADD_SERVICES_20251008.md`

---

### 7. Error Logging Enhancement

**Problem:** Insufficient error details made debugging difficult.

**Solution:** Enhanced logging with:
- Full Square API error responses
- Request/response payloads (sanitized)
- Emoji prefixes for easy log scanning
- Contextual information (booking IDs, customer data)

```javascript
console.error('❌ Square API Error:', {
  statusCode: error.statusCode,
  errorBody: error.body,
  requestData: sanitizedRequest
});
```

**Files Archived:**
- `FIX_ERROR_LOGGING_20251008.md`
- `ENHANCED_ERROR_LOGGING_PATCH.md`

---

### 8. ElevenLabs Integration Issues

**Problem:** Tool responses not formatted correctly for AI agent parsing.

**Solution:**
- Return JSON responses with clear structure
- Include human-readable success/error messages
- Provide booking confirmations with all details
- Use consistent response format across all tools

**Files Archived:**
- `FIX_ELEVENLABS_BOOKING_20251006.md`

---

## Testing Procedures

### Local Testing
```bash
# Test availability
curl -X POST http://localhost:8080/tools/getAvailability \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2025-10-15","serviceVariationId":"7XPUHGDLY4N3H2OWTHMIABKF"}'

# Test booking creation
curl -X POST http://localhost:8080/tools/createBooking \
  -H "Content-Type: application/json" \
  -d '{"customerName":"John Doe","customerPhone":"5715276016","startTime":"2025-10-15T14:00:00-04:00","serviceVariationId":"7XPUHGDLY4N3H2OWTHMIABKF"}'
```

### Cloud Run Testing
```bash
# Health check
curl https://your-cloud-run-url/health

# Test with real Square data
curl -X POST https://your-cloud-run-url/tools/lookupBooking \
  -H "Content-Type: application/json" \
  -d '{"customerPhone":"5715276016"}'
```

### ElevenLabs Agent Testing
See `ELEVENLABS_TESTING_GUIDE.md` for detailed agent testing procedures.

---

## Common Error Messages

### "Invalid phone number format"
- Ensure phone number normalization
- Check E.164 format for search operations
- Use 10-digit format for customer creation

### "Booking time conflicts with existing appointment"
- Verify cancelled bookings are filtered
- Check overlap detection logic
- Ensure timezone is correct

### "Cannot serialize BigInt to JSON"
- Apply `sanitizeBigInts()` before JSON.stringify()
- Check all Square API responses

### "Invalid timezone offset"
- Use America/New_York timezone
- Include -04:00 or -05:00 offset
- Let auto-correction fix missing offsets

---

## Deployment Checklist

1. **Environment Variables**
   - ✅ SQUARE_ACCESS_TOKEN set
   - ✅ SQUARE_LOCATION_ID set
   - ✅ PORT configured (default: 8080)

2. **Code Verification**
   - ✅ All phone numbers use correct format
   - ✅ Snake_case for Square API fields
   - ✅ BigInt sanitization applied
   - ✅ Timezone handling validated

3. **Testing**
   - ✅ Health endpoint responds
   - ✅ Tool endpoints tested with sample data
   - ✅ ElevenLabs agent integration verified

4. **Monitoring**
   - ✅ Cloud Run logs reviewed
   - ✅ Error patterns checked
   - ✅ Performance metrics acceptable

---

## Historical Documentation

All historical fix and debugging documentation has been moved to the `/archive` folder:

- FIX_* files (various dates)
- ACTION_REQUIRED.md
- DEPLOY_NOW.md
- INVESTIGATION_SUMMARY.md
- ISSUE_20251006_BOOKINGS_404.md
- And other completed troubleshooting docs

These are preserved for historical reference but are no longer actively maintained.

---

## Additional Resources

- **Main Documentation**: `README.md`
- **Version History**: `CHANGELOG.md`
- **ElevenLabs Setup**: `ELEVENLABS_SETUP.md`
- **System Prompt**: `ELEVENLABS_SYSTEM_PROMPT.md`
- **Testing Guide**: `ELEVENLABS_TESTING_GUIDE.md`
- **Tool Configs**: `ELEVENLABS_TOOL_CONFIGS.md`
- **Service IDs**: `SERVICE_VARIATION_IDS.md`
- **Quick Reference**: `QUICKREF.md`

---

**Last Updated:** October 2025  
**Version:** 2.8.10+
