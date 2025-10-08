# 🔥 Fix: Add Services to Booking - v2.5.0

## Issue: "Eyebrows Waxing" Service Not Found

**Error**: `Service 'Eyebrows Waxing' not found in Square variation mapping`

**Root Cause**: Service name mismatch
- Square has: **"Eyebrow Waxing"** (singular) ✅
- AI was using: **"Eyebrows Waxing"** (plural) ❌

---

## Complete Solution Deployed

### 1. **New Endpoint**: `/tools/addServicesToBooking`

Adds multiple services to an existing booking with:
- ✅ Exact service name validation using `SERVICE_MAPPINGS`
- ✅ Time conflict detection
- ✅ Barber eligibility check
- ✅ Clear error messages

### 2. **Service Mappings Added**

```javascript
const SERVICE_MAPPINGS = {
  'Regular Haircut': '7XPUHGDLY4N3H2OWTHMIABKF',
  'Beard Trim': 'SPUX6LRBS6RHFBX3MSRASG2J',
  'Beard Sculpt': 'UH5JRVCJGAB2KISNBQ7KMVVQ',
  'Ear Waxing': 'ALZZEN4DO6JCNMC6YPXN6DPH',
  'Nose Waxing': 'VVGK7I7L6BHTG7LFKLAIRHBZ',
  'Eyebrow Waxing': '3TV5CVRXCB62BWIWVY6OCXIC', // ← SINGULAR!
  'Paraffin': '7ND6OIFTRLJEPMDBBI3B3ELT',
  'Gold': '7UKWUIF4CP7YR27FI52DWPEN',
  'Silver': '7PFUQVFMALHIPDAJSYCBKBYV'
};
```

---

## Deployment Commands

```bash
cd ~/ai_receptionist

# Checkout the fix branch
git pull origin fix/add-services-v2.5.0

# Deploy to Cloud Run
gcloud builds submit --tag gcr.io/website-473417/k-barbershop-backend

gcloud run deploy k-barbershop-backend \
  --image gcr.io/website-473417/k-barbershop-backend \
  --platform managed \
  --region us-east4 \
  --allow-unauthenticated \
  --set-env-vars SQUARE_ACCESS_TOKEN=$SQUARE_ACCESS_TOKEN,SQUARE_LOCATION_ID=LCS4MXPZP8J3M
```

---

## ElevenLabs Configuration

### Add New Tool

```json
{
  "name": "addServicesToBooking",
  "description": "Add additional services to an existing booking",
  "url": "https://k-barbershop-backend-473417.us-east4.run.app/tools/addServicesToBooking",
  "method": "POST",
  "body": {
    "type": "object",
    "properties": {
      "bookingId": {
        "type": "string",
        "description": "The booking ID from lookupBooking"
      },
      "serviceNames": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": [
            "Regular Haircut",
            "Beard Trim",
            "Beard Sculpt",
            "Ear Waxing",
            "Nose Waxing",
            "Eyebrow Waxing",
            "Paraffin",
            "Gold",
            "Silver"
          ]
        }
      }
    },
    "required": ["bookingId", "serviceNames"]
  }
}
```

### Update System Prompt

Add this section:

```
## CRITICAL: Exact Service Names

When adding services, use EXACT names:
- ✅ "Eyebrow Waxing" (singular)
- ❌ NOT "Eyebrows Waxing" (plural)

All 9 services:
- Regular Haircut
- Beard Trim
- Beard Sculpt
- Ear Waxing
- Nose Waxing
- Eyebrow Waxing  ← SINGULAR!
- Paraffin
- Gold
- Silver

## Adding Services Workflow

1. Lookup booking: lookupBooking(phone)
2. Add services: addServicesToBooking(bookingId, ["Ear Waxing", "Nose Waxing", "Eyebrow Waxing"])
3. Handle response:
   - If success: Confirm services added
   - If conflict: Offer separate appointment or suggest asking barber on arrival
```

---

## API Response Examples

### Success (No Conflict)
```json
{
  "success": true,
  "servicesAdded": ["Ear Waxing", "Nose Waxing", "Eyebrow Waxing"],
  "totalServices": 4,
  "message": "Successfully added... Your appointment will now take approximately 60 minutes."
}
```

### Time Conflict Detected
```json
{
  "success": false,
  "hasConflict": true,
  "message": "I cannot add these services to your 10/09/2025 at 10:00 AM EDT appointment because we have another customer scheduled at 10/09/2025 at 10:30 AM EDT...",
  "nextBooking": "10/09/2025 at 10:30 AM EDT",
  "additionalDuration": 30
}
```

### Invalid Service Name
```json
{
  "success": false,
  "error": "Invalid service names: Eyebrows Waxing. Valid names are: Regular Haircut, Beard Trim..."
}
```

---

## Testing

### Test 1: Add Services Successfully
```
Customer: "Can you add ear, nose, and eyebrow waxing to my 10 AM appointment?"
Expected: Services added, total time = 60 minutes
```

### Test 2: Time Conflict
```
Customer has 10:00 AM appointment, another customer at 10:30 AM
Customer: "Add nose waxing"
Expected: Conflict message with options
```

### Test 3: Invalid Name
```
Customer: "Add eyebrows waxing"
Expected: Error listing valid names
```

---

## Monitoring

```bash
# Check deployment
gcloud run services describe k-barbershop-backend --region us-east4

# View logs
gcloud logging read "resource.type=cloud_run_revision" \
  --limit 50 \
  --format json

# Look for:
# ✅ Updated booking {id} with {n} additional service(s)
# 🚫 Time conflict detected
# ❌ Invalid service names
```

---

## Rollback (if needed)

```bash
gcloud run services update-traffic k-barbershop-backend \
  --to-revisions=k-barbershop-backend-00057-rbf=100 \
  --region us-east4
```

---

## Version History

- **v2.5.0** (Current): Add services endpoint with conflict detection
- **v2.4.1**: Timezone formatting fix
- **v2.4.0**: Filter booked slots
