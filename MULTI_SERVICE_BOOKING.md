# Multi-Service Booking Feature Guide

## Overview

Version 2.9.0 introduces the ability to book **multiple services in a SINGLE appointment**, eliminating the need for separate back-to-back bookings.

---

## What Changed

### Before (v2.8.x)
```
Customer: "I want a haircut and beard trim"
System: Creates 2 appointments
  - 2:00 PM: Haircut (30 min)
  - 2:30 PM: Beard Trim (30 min)
```

### After (v2.9.0)
```
Customer: "I want a haircut and beard trim"
System: Creates 1 appointment with both services
  - 2:00 PM: Haircut + Beard Trim (60 min total)
```

---

## Technical Implementation

### Backend Changes

#### Modified Function: `createBooking()`

**Location:** `src/services/bookingService.js`

**New Signature:**
```javascript
createBooking(customerId, startTime, serviceVariationIds, teamMemberId)
```

**Key Changes:**
- Accepts both single service ID (string) OR array of service IDs
- Automatically calculates total duration across all services
- Creates single appointment with multiple `appointmentSegments`
- Returns `duration_minutes` and `service_count` in response

**Example Usage:**
```javascript
// Single service (backward compatible)
await createBooking(
  'customer123',
  '2025-10-08T14:00:00-04:00',
  '7XPUHGDLY4N3H2OWTHMIABKF',  // Single ID
  'TMKzhB-WjsDff5rr'
);

// Multiple services (NEW)
await createBooking(
  'customer123',
  '2025-10-08T14:00:00-04:00',
  [
    '7XPUHGDLY4N3H2OWTHMIABKF',  // Haircut (30 min)
    'SPUX6LRBS6RHFBX3MSRASG2J'   // Beard Trim (30 min)
  ],
  'TMKzhB-WjsDff5rr'
);

// Returns:
{
  id: 'booking_abc123',
  duration_minutes: 60,
  service_count: 2,
  // ... other Square booking fields
}
```

### API Endpoint Changes

#### POST /createBooking

**New Request Parameters:**
```json
{
  "customerName": "John Smith",
  "customerPhone": "5551234567",
  "startTime": "2025-10-08T14:00:00-04:00",
  
  // Option 1: Single service (backward compatible)
  "serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF",
  
  // Option 2: Multiple services (NEW)
  "serviceVariationIds": [
    "7XPUHGDLY4N3H2OWTHMIABKF",
    "SPUX6LRBS6RHFBX3MSRASG2J"
  ],
  
  "teamMemberId": "TMKzhB-WjsDff5rr"  // optional
}
```

**Enhanced Response:**
```json
{
  "success": true,
  "booking": { /* Square booking object */ },
  "bookingId": "booking_abc123",
  "duration_minutes": 60,
  "service_count": 2,
  "services": ["Regular Haircut", "Beard Trim"],
  "message": "Appointment created successfully for John Smith. Total duration: 60 minutes (Regular Haircut, Beard Trim)",
  "newCustomer": false
}
```

---

## AI Agent Configuration

### ElevenLabs System Prompt Updates

The AI agent has been trained to:

1. **Listen for multiple services** in customer requests
   - "I want a haircut and beard trim"
   - "Can I get a haircut, beard trim, and eyebrow waxing?"

2. **Ask for additional services** after customer mentions one
   - Customer: "I want a haircut"
   - AI: "Would you like to add any other services to your appointment?"

3. **Inform customer of total duration**
   - "That'll be 60 minutes total for your haircut and beard trim"

4. **Book all services in ONE appointment** (not separate)
   - Uses `serviceVariationIds` array parameter
   - Creates single Square booking with multiple segments

### Key AI Instructions

**DO:**
- ✅ "I'll book both services in your 2pm appointment"
- ✅ "That's 60 minutes total for haircut and beard trim"
- ✅ Ask "Would you like to add any other services?"

**DON'T:**
- ❌ "I'll book your haircut at 2pm and beard trim at 2:30pm"
- ❌ Create separate appointments for each service
- ❌ Forget to mention total duration

---

## Duration Calculation

Service durations are defined in `src/config/constants.js`:

```javascript
export const SERVICE_DURATIONS = {
  '7XPUHGDLY4N3H2OWTHMIABKF': 1800000, // Haircut - 30 min
  'SPUX6LRBS6RHFBX3MSRASG2J': 1800000, // Beard Trim - 30 min
  'UH5JRVCJGAB2KISNBQ7KMVVQ': 1800000, // Beard Sculpt - 30 min
  'ALZZEN4DO6JCNMC6YPXN6DPH': 600000,  // Ear Waxing - 10 min
  'VVGK7I7L6BHTG7LFKLAIRHBZ': 600000,  // Nose Waxing - 10 min
  '3TV5CVRXCB62BWIWVY6OCXIC': 600000,  // Eyebrow Waxing - 10 min
  '7ND6OIFTRLJEPMDBBI3B3ELT': 1800000, // Paraffin - 30 min
  '7UKWUIF4CP7YR27FI52DWPEN': 5400000, // Gold - 90 min
  '7PFUQVFMALHIPDAJSYCBKBYV': 3600000  // Silver - 60 min
};
```

**Example Calculations:**
- Haircut (30) + Beard Trim (30) = **60 minutes**
- Haircut (30) + Beard Trim (30) + Ear Waxing (10) = **70 minutes**
- Gold Package (90) alone = **90 minutes**

---

## Conflict Detection

The system validates that multi-service appointments don't overlap with subsequent bookings:

### Scenario 1: No Conflict (Allowed)
```
Existing appointments:
  - 2:00 PM - 3:00 PM: Customer A
  - 3:00 PM - 3:30 PM: Customer B

New booking request:
  - 2:00 PM: Haircut + Beard Trim (60 min total)
  
Result: ✅ ALLOWED (ends exactly when Customer B starts)
```

### Scenario 2: Overlap (Blocked)
```
Existing appointments:
  - 2:00 PM - 3:00 PM: Customer A
  - 2:45 PM - 3:15 PM: Customer B

New booking request:
  - 2:00 PM: Haircut + Beard Trim (60 min total)
  
Result: ❌ BLOCKED (would overlap with Customer B)
Error: "Cannot add services - would overlap with 2:45 PM appointment"
```

---

## Common Use Cases

### Use Case 1: Customer Requests Multiple Services Upfront

**Customer:** "I want a haircut and beard trim tomorrow at 2pm"

**AI Flow:**
1. Calls `getCurrentDateTime` to know "tomorrow"
2. Calls `getAvailability` for 2pm tomorrow
3. Responds: "Perfect! That'll be 60 minutes total. May I have your name and phone?"
4. Collects customer info
5. Calls `createBooking` with `serviceVariationIds: ['7XPUHGDLY4N3H2OWTHMIABKF', 'SPUX6LRBS6RHFBX3MSRASG2J']`
6. Confirms: "You're all set for tomorrow at 2pm for your haircut and beard trim!"

### Use Case 2: Customer Initially Requests One Service

**Customer:** "I want a haircut tomorrow at 2pm"

**AI Flow:**
1. Responds: "Great! Would you like to add any other services to your appointment?"
2. **Customer:** "Yes, add a beard trim"
3. AI now books BOTH services in one appointment
4. Confirms with total duration: "60 minutes total"

### Use Case 3: Customer Adds Service to Existing Appointment

**Customer:** "I have an appointment tomorrow at 2pm. Can I add a beard trim?"

**AI Flow:**
1. Verifies identity and looks up booking
2. Calls `addServicesToBooking` with `serviceNames: ['Beard Trim']`
3. System checks for conflicts
4. If no conflict: "Perfect! Your appointment will now take 60 minutes total"
5. If conflict: "Unfortunately, we have another customer at 2:45pm and adding the beard trim would overlap. Would you like to reschedule?"

---

## Testing Guide

### Test Scenario 1: Single Service (Backward Compatibility)

**Request:**
```bash
curl -X POST https://your-api.com/createBooking \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Test User",
    "customerPhone": "5551234567",
    "startTime": "2025-10-15T14:00:00-04:00",
    "serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "duration_minutes": 30,
  "service_count": 1,
  "services": ["Regular Haircut"]
}
```

### Test Scenario 2: Multiple Services

**Request:**
```bash
curl -X POST https://your-api.com/createBooking \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Test User",
    "customerPhone": "5551234567",
    "startTime": "2025-10-15T14:00:00-04:00",
    "serviceVariationIds": [
      "7XPUHGDLY4N3H2OWTHMIABKF",
      "SPUX6LRBS6RHFBX3MSRASG2J",
      "ALZZEN4DO6JCNMC6YPXN6DPH"
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "duration_minutes": 70,
  "service_count": 3,
  "services": [
    "Regular Haircut",
    "Beard Trim",
    "Ear Waxing"
  ]
}
```

### Test Scenario 3: Add Services to Existing Booking

**Request:**
```bash
curl -X POST https://your-api.com/addServicesToBooking \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "booking_abc123",
    "serviceNames": ["Beard Trim", "Ear Waxing"]
  }'
```

**Expected Response (No Conflict):**
```json
{
  "success": true,
  "servicesAdded": ["Beard Trim", "Ear Waxing"],
  "totalServices": 3,
  "message": "Successfully added Beard Trim, Ear Waxing to your appointment. Your appointment will now take approximately 70 minutes."
}
```

**Expected Response (Conflict):**
```json
{
  "success": false,
  "hasConflict": true,
  "message": "I cannot add these services to your 2:00 PM appointment because we have another customer scheduled at 2:45 PM. The additional services would take 40 minutes and would overlap with the next appointment.",
  "nextBooking": "Thu, Oct 10, 2025 2:45 PM EDT",
  "additionalDuration": 40
}
```

---

## Migration & Deployment

### Step 1: Deploy Backend
```bash
# Pull latest code
git pull origin main

# Verify version
grep VERSION src/config/constants.js
# Should show: export const VERSION = '2.9.0';

# Deploy to Cloud Run (or your environment)
gcloud run deploy ai-receptionist --source .
```

### Step 2: Update ElevenLabs Agent

1. Go to ElevenLabs dashboard
2. Navigate to your K Barbershop agent
3. Update System Prompt with new content from `ELEVENLABS_SYSTEM_PROMPT.md`
4. Key sections to update:
   - Section 2.1: "Booking Multiple Services in One Appointment"
   - Critical Rules: Items 16-18
   - Tool documentation for `createBooking`
5. Test with sample queries

### Step 3: Verify Integration

**Test 1: Single Service (Backward Compatibility)**
- Customer says: "I want a haircut tomorrow at 2pm"
- Agent should book successfully
- Check Square dashboard: 1 appointment with 1 service

**Test 2: Multiple Services**
- Customer says: "I want a haircut and beard trim tomorrow at 2pm"
- Agent should book successfully
- Check Square dashboard: 1 appointment with 2 services, 60 minutes total

**Test 3: Ask for Additional Services**
- Customer says: "I want a haircut"
- Agent asks: "Would you like to add any other services?"
- Customer says: "Yes, a beard trim"
- Should book as single appointment with both services

---

## Troubleshooting

### Issue: Agent Creating Separate Appointments

**Symptoms:**
- Customer requests "haircut and beard trim"
- Agent creates 2 separate bookings (e.g., 2:00pm and 2:30pm)

**Solution:**
- Verify ElevenLabs system prompt includes section 2.1
- Check that prompt includes rule #16: "Multiple services = ONE appointment"
- Test agent understanding with: "I want haircut and beard trim - book them together in one appointment"

### Issue: Total Duration Not Communicated

**Symptoms:**
- Agent books multi-service appointment
- Doesn't tell customer total time

**Solution:**
- Verify system prompt includes: "Always inform total duration"
- Check API response includes `duration_minutes` field
- Agent should read from response: "That'll be {duration_minutes} minutes total"

### Issue: Conflict Detection Too Aggressive

**Symptoms:**
- Agent rejects valid multi-service bookings
- Claims overlap when there's sufficient time

**Solution:**
- Check `SERVICE_DURATIONS` in `src/config/constants.js`
- Verify duration calculations: `console.log` in `createBooking()`
- Review conflict detection logic in `checkForOverlaps()`

---

## Future Enhancements

Potential improvements for future versions:

1. **Dynamic Service Duration**
   - Allow barbers to set custom durations per service
   - Account for individual work speed

2. **Service Bundles/Packages**
   - Pre-defined service combinations
   - Discounted pricing for bundles

3. **Break Time Calculation**
   - Add buffer time between services within same appointment
   - Account for cleanup/setup time

4. **Parallel Services**
   - Support for services done simultaneously by different team members
   - Complex duration calculations

5. **Customer Preferences**
   - Remember favorite service combinations
   - Suggest commonly paired services

---

## Support

For issues or questions:
1. Check Cloud Run logs for backend errors
2. Review ElevenLabs conversation logs for AI behavior
3. Verify Square API responses
4. Contact: [Your support contact]

---

**Version:** 2.9.0  
**Last Updated:** October 12, 2025  
**Author:** K Barbershop Development Team
