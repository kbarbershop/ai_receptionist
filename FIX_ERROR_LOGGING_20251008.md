# Fix v2.7.7: Enhanced Error Logging for Square API 400 Errors

**Date:** October 8, 2025  
**Issue:** Square API returning 400 Bad Request errors with insufficient error details  
**Version:** 2.7.7

## Problem Summary

The system was experiencing intermittent 400 errors from Square's `searchAvailability` API when the `/tools/getAvailability` endpoint was called. The error logs only showed:

```
getAvailability error: ApiError: Response status code was not ok: 400.
```

This generic message didn't provide enough information to diagnose WHY Square was rejecting the requests.

## Root Cause

The error handling in the `getAvailability` function only logged `error.message`, which didn't include the detailed error information from Square's API. Square API errors contain additional details in:
- `error.errors` array
- `error.result.errors` object

Without these details, it was impossible to determine if the issue was:
- Invalid date/time format
- Invalid service variation ID
- Invalid time range (start_at after end_at)
- Dates in the past
- Or some other parameter issue

## Solution Implemented

### 1. Enhanced Error Logging

**Location:** `server.js` lines ~554-566

**Before:**
```javascript
} catch (error) {
  console.error('getAvailability error:', error);
  res.status(500).json({
    success: false,
    error: error.message
  });
}
```

**After:**
```javascript
} catch (error) {
  // 🔥 v2.7.7: Enhanced error logging - capture Square API details
  console.error('❌ getAvailability error:', error.message);
  console.error('❌ Error stack:', error.stack);
  
  // Log detailed error information from Square API
  if (error.errors && Array.isArray(error.errors)) {
    console.error('❌ Square API errors:', JSON.stringify(error.errors, null, 2));
  }
  if (error.result && error.result.errors) {
    console.error('❌ Square result errors:', JSON.stringify(error.result.errors, null, 2));
  }
  
  res.status(500).json({
    success: false,
    error: error.message,
    details: error.errors || error.result?.errors || []
  });
}
```

### 2. API Parameter Logging

**Location:** `server.js` lines ~336-344

Added logging of the exact parameters being sent to Square API:

```javascript
// 🔥 v2.7.7: Log the exact parameters being sent to Square API
const apiParams = {
  query: {
    filter: {
      locationId: LOCATION_ID,
      startAtRange: {
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString()
      },
      segmentFilters: [segmentFilter]
    }
  }
};
console.log(`🔧 Calling Square searchAvailability with:`, JSON.stringify(apiParams, null, 2));

const response = await squareClient.bookingsApi.searchAvailability(apiParams);
```

## What This Fix Enables

Now when a 400 error occurs, the logs will show:

1. **Error message** - The basic error description
2. **Stack trace** - Where the error occurred in the code
3. **Square API errors** - The detailed error array from Square, which typically includes:
   - Error code (e.g., `INVALID_REQUEST_ERROR`, `VALUE_TOO_LONG`, `INVALID_VALUE`)
   - Error category (e.g., `INVALID_REQUEST_ERROR`)
   - Error field - Which field caused the error
   - Error detail - Human-readable explanation
4. **API parameters** - The exact request sent to Square, showing:
   - Location ID
   - Start and end times (in UTC)
   - Service variation ID
   - Team member filter

## Example of Enhanced Error Output

**Before (v2.7.6):**
```
getAvailability error: ApiError: Response status code was not ok: 400.
```

**After (v2.7.7):**
```
🔧 Calling Square searchAvailability with: {
  "query": {
    "filter": {
      "locationId": "LCS4MXPZP8J3M",
      "startAtRange": {
        "startAt": "2025-10-08T04:00:00.000Z",
        "endAt": "2025-10-09T03:59:59.000Z"
      },
      "segmentFilters": [
        {
          "serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF",
          "teamMemberIdFilter": {
            "any": []
          }
        }
      ]
    }
  }
}

❌ getAvailability error: Response status code was not ok: 400.
❌ Error stack: ApiError: Response status code was not ok: 400.
    at HttpClient.executeRequest (/app/node_modules/square/dist/core/httpClient.js:123:45)
    ...
❌ Square API errors: [
  {
    "category": "INVALID_REQUEST_ERROR",
    "code": "INVALID_VALUE",
    "detail": "The start_at time must be in the future",
    "field": "query.filter.start_at_range.start_at"
  }
]
```

## Benefits

1. **Faster Debugging** - Can immediately see what's wrong without guessing
2. **Better Error Tracking** - Can identify patterns in errors (e.g., always date-related, always service ID-related)
3. **Improved Response** - Can return detailed error info to the client for better error messages
4. **Root Cause Analysis** - Can see the exact parameters that caused the error

## Monitoring & Next Steps

### How to Check Logs

Use Google Cloud Console to search for errors:

```bash
# Search for any getAvailability errors
resource.type="cloud_run_revision" 
AND textPayload=~"getAvailability error"

# Search for Square API errors specifically
resource.type="cloud_run_revision" 
AND textPayload=~"Square API errors"
```

### What to Look For

When reviewing logs after this fix, look for patterns in the Square API errors:

1. **Date/Time Issues:**
   - `"detail": "The start_at time must be in the future"`
   - `"field": "query.filter.start_at_range.start_at"`
   - **Solution:** Need to improve past-date validation

2. **Invalid Service ID:**
   - `"detail": "Invalid service variation ID"`
   - `"field": "query.filter.segment_filters[0].service_variation_id"`
   - **Solution:** Validate service IDs before calling API

3. **Invalid Time Range:**
   - `"detail": "end_at must be after start_at"`
   - **Solution:** Already have validation at line 318, but may need strengthening

4. **Location Issues:**
   - `"detail": "Location not found"`
   - `"field": "query.filter.location_id"`
   - **Solution:** Verify LOCATION_ID environment variable

## Testing the Fix

### Test Case 1: Trigger a Known Error

```bash
curl -X POST https://YOUR_CLOUD_RUN_URL/tools/getAvailability \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF"
  }'
```

**Expected:** Should return error with detailed message about date being in the past

### Test Case 2: Invalid Service ID

```bash
curl -X POST https://YOUR_CLOUD_RUN_URL/tools/getAvailability \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-10-15",
    "serviceVariationId": "INVALID_ID_12345"
  }'
```

**Expected:** Should return error with details about invalid service variation ID

### Test Case 3: Valid Request (Should Work)

```bash
curl -X POST https://YOUR_CLOUD_RUN_URL/tools/getAvailability \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-10-15",
    "serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF"
  }'
```

**Expected:** Should return available time slots successfully

## Deployment

This fix has been deployed to the `main` branch and will be automatically deployed to Cloud Run via GitHub Actions.

**Version:** 2.7.7  
**Commit:** a0e5b7ceeb7527a62d8a3776f4e624da3d0e9d32  
**Deployed:** October 8, 2025

## Files Changed

1. **server.js**
   - Enhanced error logging in getAvailability catch block (lines ~554-566)
   - Added API parameter logging before Square API call (lines ~336-344)
   - Updated version to 2.7.7 in health endpoint

2. **FIX_ERROR_LOGGING_20251008.md** (this file)
   - Complete documentation of the error logging enhancements

## No Functional Changes

⚠️ **Important:** This fix only adds logging. It does NOT change any functionality:
- No changes to how dates are processed
- No changes to validation logic
- No changes to the API responses (except adding `details` field to errors)
- No changes to time zone handling

## Common Square API Errors & Solutions

Based on Square API documentation, here are common errors we might see:

| Error Code | Field | Meaning | Fix |
|------------|-------|---------|-----|
| `INVALID_VALUE` | `start_at` | Date is in the past | Improve date validation |
| `INVALID_VALUE` | `service_variation_id` | Service doesn't exist | Validate service IDs |
| `INVALID_REQUEST_ERROR` | `end_at` | end_at before start_at | Already fixed in v2.7.4 |
| `NOT_FOUND` | `location_id` | Location doesn't exist | Check env variable |
| `INVALID_VALUE` | `team_member_id` | Team member not found | Validate team member |

## Support

If you see recurring 400 errors after this fix:

1. Check Cloud Run logs for the detailed error messages
2. Look for the `Square API errors` log entry
3. Identify the error code and field
4. Refer to the table above for potential fixes
5. Create a new fix version if a pattern emerges

## Related Fixes

- **v2.7.5** - Fixed past date requests (rejects 2024 dates when in 2025)
- **v2.7.4** - Fixed invalid time range error (end_at before start_at)
- **v2.7.3** - Fixed "Bookings can only be made in the future" error

This logging enhancement will help us identify if there are any remaining edge cases not covered by these previous fixes.

---

**Author:** Claude  
**Last Updated:** October 8, 2025  
**Status:** Deployed to Production
