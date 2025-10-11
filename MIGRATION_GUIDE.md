# Migration Guide: v2.8.8 → v2.8.10

## Overview

Version 2.8.10 represents a **major restructuring** from a monolithic `server.js` (1,300+ lines) to a clean, modular architecture. This guide will help you migrate smoothly.

## What Changed?

### Architecture

**Before (v2.8.8):**
```
server.js (1,300+ lines)
package.json
```

**After (v2.8.10):**
```
src/
├── config/       # Configuration & constants
├── utils/        # Utility functions
├── services/     # Business logic
├── routes/       # API endpoints
└── app.js        # Main application
package.json
Dockerfile
```

### Breaking Changes

#### 1. Entry Point Changed
- **Old:** `node server.js`
- **New:** `node src/app.js` or `npm start`

#### 2. Phone Number Format (CRITICAL FIX)

**v2.8.8 had a bug** where `createCustomer` used the wrong phone format.

**v2.8.10 fixes this:**
- **Search customers**: `+15715276016` (E.164 with +)
- **Create customer**: `5715276016` (10 digits, no +1)

This is now handled automatically by `formatPhoneForCreation()` in `utils/phoneNumber.js`.

#### 3. Module System

All files now use **ES6 modules** (`import/export`) instead of mixing styles.

## Migration Steps

### Step 1: Update Dependencies

```bash
# Pull latest code
git pull origin main

# Remove old dependencies
rm -rf node_modules package-lock.json

# Install fresh
npm install
```

### Step 2: Update Environment Variables

No changes needed! Same environment variables:
```bash
SQUARE_ACCESS_TOKEN=your_token
SQUARE_LOCATION_ID=LCS4MXPZP8J3M
PORT=8080
```

### Step 3: Test Locally

```bash
# Start server
npm start

# Test health endpoint
curl http://localhost:8080/health

# Should return version 2.8.10
```

### Step 4: Deploy to Cloud Run

#### Option A: Using Dockerfile (Recommended)

```bash
# Build container
gcloud builds submit --tag gcr.io/YOUR-PROJECT-ID/ai-receptionist

# Deploy
gcloud run deploy ai-receptionist \
  --image gcr.io/YOUR-PROJECT-ID/ai-receptionist \
  --platform managed \
  --region us-east1 \
  --set-env-vars SQUARE_ACCESS_TOKEN=$SQUARE_ACCESS_TOKEN
```

#### Option B: Direct Deploy

```bash
gcloud run deploy ai-receptionist \
  --source . \
  --platform managed \
  --region us-east1 \
  --set-env-vars SQUARE_ACCESS_TOKEN=$SQUARE_ACCESS_TOKEN
```

### Step 5: Update ElevenLabs Agent

No changes needed! All API endpoints remain the same:
- `POST /tools/getCurrentDateTime`
- `POST /tools/getAvailability`
- `POST /tools/createBooking`
- etc.

### Step 6: Monitor Logs

```bash
# View Cloud Run logs
gcloud run services logs tail ai-receptionist

# Look for the startup message showing v2.8.10
```

## API Compatibility

✅ **100% Backward Compatible**

All endpoints work exactly the same:
- Same request formats
- Same response formats
- Same error handling
- Same phone number inputs (normalization handles everything)

## Code Organization Benefits

### Before: Monolithic Structure

**Problems:**
- 1,300+ lines in single file
- Hard to debug and maintain
- Difficult to test individual components
- No clear separation of concerns
- Helper functions mixed with routes

### After: Modular Structure

**Benefits:**
- ✅ Clear separation of concerns
- ✅ Easy to locate and fix bugs
- ✅ Reusable utility functions
- ✅ Testable service layer
- ✅ Scalable architecture
- ✅ Better code organization

## File Mapping

Here's where old code moved:

| Old Location | New Location |
|--------------|-------------|
| Phone helpers | `src/utils/phoneNumber.js` |
| Date/time helpers | `src/utils/datetime.js` |
| BigInt helpers | `src/utils/bigint.js` |
| Constants | `src/config/constants.js` |
| Square client | `src/config/square.js` |
| Customer logic | `src/services/customerService.js` |
| Booking logic | `src/services/bookingService.js` |
| Availability logic | `src/services/availabilityService.js` |
| Tool endpoints | `src/routes/toolsRoutes.js` |
| Health/analytics | `src/routes/analyticsRoutes.js` |
| Express app | `src/app.js` |

## Testing the Migration

### 1. Test Customer Creation

```bash
curl -X POST http://localhost:8080/tools/createBooking \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Test User",
    "customerPhone": "5715276016",
    "startTime": "2025-10-15T14:00:00-04:00",
    "serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF"
  }'
```

### 2. Test Availability

```bash
curl -X POST http://localhost:8080/tools/getAvailability \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-10-15",
    "serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF"
  }'
```

### 3. Test Lookup

```bash
curl -X POST http://localhost:8080/tools/lookupBooking \
  -H "Content-Type: application/json" \
  -d '{"customerPhone": "5715276016"}'
```

## Rollback Plan

If you need to rollback to v2.8.8:

```bash
# Checkout v2.8.8 commit
git checkout 3d74ccc7db328fa242a4779fe39b94817ba2dd51

# Reinstall dependencies
npm install

# Run old server
node server.js
```

## Common Issues & Solutions

### Issue: "Cannot find module 'express'"

**Solution:**
```bash
npm install
```

### Issue: "Error: SQUARE_ACCESS_TOKEN not set"

**Solution:**
```bash
export SQUARE_ACCESS_TOKEN=your_token
```

### Issue: Old server.js still referenced

**Solution:**
The old `server.js` has been archived to `archive/server_v2.8.8_monolithic.js`. Update any scripts or documentation to use `src/app.js`.

### Issue: Phone number format errors

**Solution:**
v2.8.10 automatically handles phone number formatting. Just pass the phone number in any format (with or without country code, with or without formatting).

## Performance Impact

No performance degradation expected. In fact, you may see slight improvements:
- ✅ Faster startup time (better module caching)
- ✅ Same API response times
- ✅ Better error logging

## Security Improvements

- ✅ Better separation prevents accidental exposure of sensitive data
- ✅ Config isolation makes it easier to audit credentials
- ✅ Service layer prevents direct database/API manipulation

## Next Steps After Migration

1. **Monitor for 24 hours** - Watch Cloud Run logs
2. **Test all endpoints** - Use ElevenLabs agent for real bookings
3. **Update documentation** - If you have internal docs, update references
4. **Consider adding tests** - The new modular structure makes unit testing easy

## Future Enhancements Now Possible

The new architecture enables:
- ✅ Unit testing individual services
- ✅ Easier addition of new booking sources
- ✅ Redis caching at service layer
- ✅ Rate limiting middleware
- ✅ Multiple location support
- ✅ A/B testing of booking logic

## Need Help?

If you encounter issues:

1. Check Cloud Run logs: `gcloud run services logs tail ai-receptionist`
2. Verify environment variables are set
3. Test health endpoint: `curl https://your-url/health`
4. Contact: admin@k-barbershop.com

## Verification Checklist

- [ ] Code pulled from main branch
- [ ] Dependencies installed (`npm install`)
- [ ] Environment variables set
- [ ] Local server starts successfully
- [ ] Health endpoint returns v2.8.10
- [ ] Test booking creation works
- [ ] Test availability check works
- [ ] Deployed to Cloud Run
- [ ] ElevenLabs agent tested
- [ ] Cloud Run logs show no errors

---

**Migration completed successfully?** You now have a maintainable, scalable, and properly structured codebase! 🎉
