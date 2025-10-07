# Fix: Phone Number Format Issue

**Date:** October 6, 2025, 9:30 PM
**Error:** Square Customer API returns 400 - INVALID_REQUEST_ERROR on phone field

## Root Cause

Square API inconsistency:
- **Search API** expects: `"15555555555"` (digits only, no +)
- **Create API** expects: `"+15555555555"` (E.164 with +)

We were:
- Searching with: `normalizedPhone.replace(/\D/g, '')` = `"15555555555"` ✅
- Creating with: `normalizedPhone` = `"+15555555555"` ✅
- But when customer exists with `"+15555555555"`, search with `"15555555555"` doesn't find it
- Then tries to create duplicate → 400 error ❌

## The Fix

Use the SAME format for both search and create - use E.164 WITHOUT the + prefix:

```javascript
// Normalize to: 15555555555 (11 digits, no +)
const normalizedPhone = normalizePhoneNumber(customerPhone).replace(/^\+/, '');

// Search with same format
searchCustomers({ phoneNumber: { exact: normalizedPhone }})

// Create with same format  
createCustomer({ phone_number: normalizedPhone })
```

## Files to Update

`server.js` - Line ~226-250 in createBooking function

**Change from:**
```javascript
const normalizedPhone = normalizePhoneNumber(customerPhone);
// Search: normalizedPhone.replace(/\D/g, '')
// Create: normalizedPhone
```

**Change to:**
```javascript
const normalizedPhone = normalizePhoneNumber(customerPhone).replace(/^\+/, '');
// Both use: normalizedPhone (11 digits, no +)
```

## Deploy Command

```bash
cd /Users/byungchanlim/square-mcp-server-deploy
./deploy.sh
```
