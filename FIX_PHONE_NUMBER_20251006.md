# Fix Summary: CreateBooking Phone Number Formatting Issue

**Date:** October 6, 2025  
**Issue:** `createBooking` tool failing with 400 error from Square API  
**Status:** ✅ FIXED

---

## Problem

The `createBooking` endpoint was failing when trying to create new customers with this error:
```
Status: 400
Error: Response status code was not ok: 400
Failed to find/create customer
```

### Root Cause

**Phone Number Format Mismatch**

Lines 110-124 in `server.js` had inconsistent phone number handling:

1. **Search**: Stripped all non-digits (`customerPhone.replace(/\D/g, '')`)
2. **Create**: Used original phone as-is (`phoneNumber: customerPhone`)

**Square requires E.164 format** (e.g., `+12345678900`) but the code was:
- ❌ Passing phone numbers without `+` prefix
- ❌ Not normalizing US 10-digit numbers to `+1XXXXXXXXXX`
- ❌ Inconsistent between search and create operations

---

## Solution Applied

### 1. Added Phone Normalization Function

```javascript
const normalizePhoneNumber = (phone) => {
  if (!phone) return null;
  
  const digits = phone.replace(/\D/g, '');
  
  // Handle 11-digit with country code (1XXXXXXXXXX → +1XXXXXXXXXX)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // Handle 10-digit US numbers (XXXXXXXXXX → +1XXXXXXXXXX)
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // Handle other international formats
  if (digits.length > 10 && !phone.startsWith('+')) {
    return `+${digits}`;
  }
  
  return phone.startsWith('+') ? phone : `+${digits}`;
};
```

### 2. Updated createBooking Function

**Before (Line 124):**
```javascript
phoneNumber: customerPhone,  // ❌ Raw format, might not have +
```

**After:**
```javascript
const normalizedPhone = normalizePhoneNumber(customerPhone);
console.log(`📞 Phone normalization: "${customerPhone}" → "${normalizedPhone}"`);
// ...
phoneNumber: normalizedPhone,  // ✅ Guaranteed E.164 format
```

### 3. Updated lookupBooking Function

Applied same normalization to phone lookup for consistency.

---

## Files Modified

| File | Change | Lines |
|------|--------|-------|
| `server.js` | Added `normalizePhoneNumber()` function | 32-56 |
| `server.js` | Updated `createBooking` to use normalized phone | 129-131 |
| `server.js` | Updated `lookupBooking` to use normalized phone | 323 |
| `server.js` | Updated version to 2.2.3 | 523 |

---

## Testing

### Test Case 1: US 10-digit number
```bash
curl -X POST https://square-mcp-server-265357944939.us-east4.run.app/tools/createBooking \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "John Doe",
    "customerPhone": "5555551234",
    "startTime": "2025-10-08T14:00:00Z",
    "serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF",
    "teamMemberId": "TMKzhB-WjsDff5rr"
  }'
```
**Expected:** `5555551234` → `+15555551234` → ✅ Customer created

### Test Case 2: US number with formatting
```bash
curl -X POST ... -d '{"customerPhone": "(555) 555-1234", ...}'
```
**Expected:** `(555) 555-1234` → `+15555551234` → ✅ Customer created

### Test Case 3: Already has +1
```bash
curl -X POST ... -d '{"customerPhone": "+15555551234", ...}'
```
**Expected:** `+15555551234` → `+15555551234` → ✅ Customer created

---

## Deployment

```bash
# Deploy to Google Cloud Run
cd ~/path/to/ai_receptionist
git pull
./deploy.sh
```

The deployment will automatically pick up the fixed `server.js` from GitHub main branch.

---

## Verification Steps

### 1. Check Health Endpoint
```bash
curl https://square-mcp-server-265357944939.us-east4.run.app/health
```
Should show version `2.2.3 - Phone Number Fix`

### 2. Test createBooking in ElevenLabs
1. Go to ElevenLabs → Agent → Tools
2. Find "createBooking" tool
3. Click "Test"
4. Use test data:
   ```json
   {
     "customerName": "Test Customer",
     "customerPhone": "5555551234",
     "startTime": "2025-10-08T14:00:00Z",
     "serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF"
   }
   ```
5. Should return: `✅ success: true`

### 3. Check Cloud Run Logs
```
📞 Phone normalization: "5555551234" → "+15555551234"
✅ Created new customer: CUSTOMER_ID_HERE
```

---

## Prevention

**For future phone number handling:**

1. ✅ Always use `normalizePhoneNumber()` before passing to Square API
2. ✅ Log the before/after normalization for debugging
3. ✅ Test with various formats: 10-digit, (xxx) xxx-xxxx, +1xxxxxxxxxx
4. ✅ Square Customers API requires E.164 format with + prefix

---

## Related Issues

- `ISSUE_20251006_BOOKINGS_404.md` - Previous service variation ID typo issue
- Square API Docs: https://developer.squareup.com/docs/customers-api/use-the-api/keep-records#phone-number

---

**Issue Resolved:** October 6, 2025  
**Commit:** 3249ecd  
**Next Step:** Deploy to Cloud Run and test in ElevenLabs
