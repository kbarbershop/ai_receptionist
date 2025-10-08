# Fix: lookupBooking Shows ALL Appointments (Past & Future)

## Problem

The `lookupBooking` endpoint was only showing appointments from NOW to 30 days in the future. This caused two issues:

1. **Missing past appointments**: If a customer calls to confirm/modify an appointment that's today or in the recent past, it wouldn't show up
2. **Confusing for AI**: The AI couldn't see completed appointments or appointments happening today

## Root Cause

In `server.js` lines 1247-1251:

```javascript
const now = new Date();
const future = new Date();
future.setDate(future.getDate() + 30);

const bookingsResponse = await squareClient.bookingsApi.listBookings(
  undefined, undefined, customerId, undefined,
  LOCATION_ID,
  now.toISOString(),  // ← ONLY FROM NOW FORWARD!
  future.toISOString()
);
```

## Solution

### Changed Time Range
```javascript
// OLD: Only show future appointments (now to +30 days)
const now = new Date();
const future = new Date();
future.setDate(future.getDate() + 30);

// NEW: Show ALL appointments (past 90 days to +90 days)
const past = new Date();
past.setDate(past.getDate() - 90);  // 90 days back
const future = new Date();
future.setDate(future.getDate() + 90);  // 90 days forward

const bookingsResponse = await squareClient.bookingsApi.listBookings(
  undefined, undefined, customerId, undefined,
  LOCATION_ID,
  past.toISOString(),  // ← NOW INCLUDES PAST
  future.toISOString()
);
```

### Filter Out Canceled

Already implemented - the code correctly filters out canceled bookings:

```javascript
const rawBookings = sanitizeBigInt(bookingsResponse.result.bookings || []);

// 🔥 Filter out CANCELLED bookings
const activeBookings = rawBookings.filter(b => 
  b.status !== 'CANCELLED_BY_SELLER' && 
  b.status !== 'CANCELLED_BY_CUSTOMER'
);
```

### Sort by Date

Added sorting so most recent/upcoming appointments appear first:

```javascript
// Sort: upcoming first, then most recent past
const sortedBookings = activeBookings.sort((a, b) => {
  const aTime = new Date(a.startAt).getTime();
  const bTime = new Date(b.startAt).getTime();
  const now = Date.now();
  
  // If both in future, sort by closest first
  if (aTime >= now && bTime >= now) return aTime - bTime;
  // If both in past, sort by most recent first
  if (aTime < now && bTime < now) return bTime - aTime;
  // If one future one past, future comes first
  return bTime >= now ? 1 : -1;
});
```

## Testing

```bash
curl -X POST https://square-mcp-server-265357944939.us-east4.run.app/tools/lookupBooking \
  -H "Content-Type: application/json" \
  -d '{"customerPhone": "+15716995142"}'
```

Should now return:
- ✅ Today's appointments
- ✅ Future appointments (up to 90 days)
- ✅ Recent past appointments (up to 90 days back)
- ❌ Canceled appointments (filtered out)

## Files Changed

- `server.js`: Modified `/tools/lookupBooking` endpoint (lines ~1245-1275)

## Version

v2.7.8 - lookupBooking now shows ALL appointments (past 90 days + future 90 days), not just future
