# Square Service Variation IDs - K Barbershop

**Location ID:** `LCS4MXPZP8J3M`

## ✅ Correct Service Variation IDs (Updated: Oct 6, 2025)

These IDs are pulled directly from Square's Catalog API and verified to work with the Bookings API.

### All 9 Services

```json
{
  "Regular Haircut": {
    "id": "7XPUHGDLY4N3H2OWTHMIABKF",
    "itemId": "SORXOW3AGW2WWLFPKA5MHUWS",
    "price": "$35.00",
    "duration": "30 minutes",
    "category": "Hair"
  },
  "Beard Trim": {
    "id": "SPUX6LRBS6RHFBX3MSRASG2J",
    "itemId": "J5562EALSIJ7526KD2OVGHWS",
    "price": "$25.00",
    "duration": "30 minutes",
    "category": "Beard"
  },
  "Beard Sculpt": {
    "id": "UH5JRVCJGAB2KISNBQ7KMVVQ",
    "itemId": "2ZLV5ZKQDHDX6QYH22YQ5RPV",
    "price": "$30.00",
    "duration": "30 minutes",
    "category": "Beard"
  },
  "Ear Waxing": {
    "id": "ALZZEN4DO6JCNMC6YPXN6DPH",
    "itemId": "E63WGLB4MLDV63J5CMYTNHQX",
    "price": "$15.00",
    "duration": "10 minutes",
    "category": "Wax"
  },
  "Nose Waxing": {
    "id": "VVGK7I7L6BHTG7LFKLAIRHBZ",
    "itemId": "ZSIF4NGZTTASMCBDQ3VOG3FI",
    "price": "$15.00",
    "duration": "10 minutes",
    "category": "Wax"
  },
  "Eyebrow Waxing": {
    "id": "3TV5CVRXCB62BWIWVY6OCXIC",
    "itemId": "Q34EIIVR2RYZJHNWCPNKTDUN",
    "price": "$15.00",
    "duration": "10 minutes",
    "category": "Wax"
  },
  "Paraffin": {
    "id": "7ND6OIFTRLJEPMDBBI3B3ELT",
    "itemId": "7IFJ2POBEKQIDKFYWWUETGN6",
    "price": "$25.00",
    "duration": "30 minutes",
    "category": "Other"
  },
  "Gold Package": {
    "id": "7UKWUIF4CP7YR27FI52DWPEN",
    "itemId": "MLGFCIXTKPLMPGZRUDZVAG55",
    "price": "$70.00",
    "duration": "90 minutes",
    "category": "Bundle",
    "description": "Silver + repairing hand paraffin wax dip + relaxing neck, shoulder, and hand massage"
  },
  "Silver Package": {
    "id": "7PFUQVFMALHIPDAJSYCBKBYV",
    "itemId": "IQRV7PMS7E6EEHPBOGMETKYJ",
    "price": "$50.00",
    "duration": "60 minutes",
    "category": "Bundle",
    "description": "Full service haircut + soothing scalp massage + invigorating face refresher"
  }
}
```

## Team Members

Both barbers are available for all services:

```json
{
  "Soon Jang": "TMeze5z5YYPIgXCe",
  "Team Member 2": "TMKzhB-WjsDff5rr"
}
```

## Usage in API Calls

### searchAvailability Example
```javascript
const response = await squareClient.bookingsApi.searchAvailability({
  query: {
    filter: {
      locationId: 'LCS4MXPZP8J3M',
      startAtRange: {
        startAt: '2025-10-07T09:00:00-04:00',
        endAt: '2025-10-08T18:00:00-04:00'
      },
      segmentFilters: [{
        serviceVariationId: '7XPUHGDLY4N3H2OWTHMIABKF', // Regular Haircut
        teamMemberIdFilter: {
          any: [] // Any team member
        }
      }]
    }
  }
});
```

### createBooking Example
```javascript
const response = await squareClient.bookingsApi.createBooking({
  booking: {
    locationId: 'LCS4MXPZP8J3M',
    startAt: '2025-10-07T14:00:00Z',
    customerId: 'CUSTOMER_ID',
    appointmentSegments: [{
      serviceVariationId: '7XPUHGDLY4N3H2OWTHMIABKF', // Regular Haircut
      teamMemberId: 'TMeze5z5YYPIgXCe', // Soon Jang
      serviceVariationVersion: BigInt(Date.now())
    }]
  },
  idempotencyKey: randomUUID()
});
```

## Important Notes

⚠️ **Common Mistake:** Don't confuse ITEM IDs with ITEM_VARIATION IDs:
- ❌ ITEM ID (parent): `SORXOW3AGW2WWLFPKA5MHUWS`
- ✅ ITEM_VARIATION ID (use this): `7XPUHGDLY4N3H2OWTHMIABKF`

⚠️ **Version Tracking:** The `serviceVariationVersion` field in bookings API should use the version from catalog search results (`1759409664884`) or generate with `BigInt(Date.now())`.

## How to Update This List

If services change in Square Dashboard:

```bash
# Get latest service IDs from Square
curl -X POST https://square-mcp-server-265357944939.us-east4.run.app/tools/generalInquiry \
  -H "Content-Type: application/json" \
  -d '{"inquiryType": "services"}'
```

## Verification

✅ **Tested:** All IDs verified working with Square Bookings API `searchAvailability` endpoint on Oct 6, 2025.

✅ **Source:** Square Catalog API `searchCatalogObjects` with `object_types: ["ITEM", "ITEM_VARIATION"]`

---

**Last Updated:** October 6, 2025  
**Square SDK Version:** 43.0.2 (Legacy API)  
**Environment:** Production
