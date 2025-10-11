// 🔥 v2.8.0: Enhanced Customer Creation Error Logging Fix

## Changes Made:
1. Enhanced error logging in createBooking endpoint around line 720
2. Updated version number to 2.8.0
3. Added detailed Square API error capture

## Location in server.js:
Around line 720 in the `createBooking` function, replace the catch block:

```javascript
} catch (error) {
  console.error('Customer find/create error details:', error);
  throw new Error(`Failed to find/create customer: ${error.message}`);
}
```

## With this enhanced version:

```javascript
} catch (error) {
  // 🔥 v2.8.0: ENHANCED error logging for customer creation failures
  console.error('❌ Customer find/create error details:', {
    message: error.message,
    statusCode: error.statusCode,
    phone: normalizedPhone,
    name: customerName,
    email: customerEmail || 'not provided',
    errors: JSON.stringify(error.errors || [], null, 2),
    result: JSON.stringify(error.result || {}, null, 2)
  });
  
  // Log the full error object for debugging
  console.error('❌ Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
  
  throw new Error(`Failed to find/create customer: ${error.message}`);
}
```

## Also update:
1. Line ~1410: version: '2.8.0 - Enhanced error logging for customer creation failures'
2. Line ~1470: Add console.log for v2.8.0

## Testing Instructions:
1. Deploy the updated server
2. Try booking with phone number 5715276016
3. Check logs for detailed Square API error information

## Expected Result:
Logs will now show exactly why Square API is rejecting the phone number, including:
- Status code
- Error messages from Square
- Full error details
- All request parameters
