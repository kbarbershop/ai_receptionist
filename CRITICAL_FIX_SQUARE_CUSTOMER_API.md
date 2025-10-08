# CRITICAL FIX REQUIRED - Square Customer API Error

## 🚨 ISSUE SUMMARY
The Python backend (`k-barbershop-backend` on Cloud Run) is experiencing a critical error when creating bookings. New customers cannot be created, causing booking failures.

## ❌ ERROR DETAILS

### Error Message
```
Square API Error: 400 - {'errors': [{'code': 'BAD_REQUEST', 'detail': "The field named 'customer' is unrecognized (line 1, character 2)", 'field': 'customer', 'category': 'INVALID_REQUEST_ERROR'}]}
```

### Stack Trace
```python
File "/app/server.py", line 381, in create_booking
  square_booking = square_service.create_booking(square_booking_data)
File "/app/square_service.py", line 592, in create_booking
  raise ValueError(f"Failed to create/find customer: {str(customer_error)}")
File "/app/square_service.py", line 668, in create_or_find_customer
  create_response = self._make_request('POST', '/customers', {
    'customer': {customer_data}  # ❌ INCORRECT - 'customer' wrapper is not valid
  })
```

## 🔍 ROOT CAUSE

The Square Customers API does **NOT** accept a `customer` wrapper object. The customer data must be sent directly in the request body.

### ❌ Current (Incorrect) Format
```python
# In square_service.py line 668
create_response = self._make_request('POST', '/customers', {
    'customer': {
        'given_name': 'John',
        'family_name': 'Doe',
        'phone_number': '+15716995142',
        'email_address': 'john@example.com'
    }
})
```

### ✅ Correct Format
```python
# Direct customer data without wrapper
create_response = self._make_request('POST', '/customers', {
    'idempotency_key': str(uuid.uuid4()),
    'given_name': 'John',
    'family_name': 'Doe',
    'phone_number': '+15716995142',
    'email_address': 'john@example.com'
})
```

## 🔧 FIX REQUIRED

### Location
File: `/app/square_service.py`
Method: `create_or_find_customer`
Line: ~668 (may vary by version)

### Change Needed

**BEFORE:**
```python
def create_or_find_customer(self, customer_name, customer_phone, customer_email=None):
    # ... search logic ...
    
    # Create new customer
    customer_data = {
        'given_name': name_parts[0],
        'family_name': ' '.join(name_parts[1:]) if len(name_parts) > 1 else '',
        'phone_number': customer_phone
    }
    
    if customer_email:
        customer_data['email_address'] = customer_email
    
    # ❌ INCORRECT: Wrapping with 'customer' key
    create_response = self._make_request('POST', '/customers', {
        'customer': customer_data  # This is the bug!
    })
```

**AFTER:**
```python
def create_or_find_customer(self, customer_name, customer_phone, customer_email=None):
    # ... search logic ...
    
    # Create new customer - prepare data WITHOUT wrapper
    customer_data = {
        'idempotency_key': str(uuid.uuid4()),  # Add idempotency key
        'given_name': name_parts[0],
        'family_name': ' '.join(name_parts[1:]) if len(name_parts) > 1 else '',
        'phone_number': customer_phone
    }
    
    if customer_email:
        customer_data['email_address'] = customer_email
    
    # ✅ CORRECT: Send customer data directly
    create_response = self._make_request('POST', '/customers', customer_data)
```

## 📝 SQUARE API REFERENCE

According to Square's official API documentation:

### Create Customer Endpoint
- **URL:** `POST /v2/customers`
- **Request Body:** Customer fields directly (NO wrapper)
- **Required Fields:** At least ONE of:
  - `given_name`
  - `family_name`
  - `company_name`
  - `email_address`
  - `phone_number`

### Example from Square Documentation
```json
POST https://connect.squareup.com/v2/customers
{
  "idempotency_key": "unique-key-123",
  "given_name": "John",
  "family_name": "Doe",
  "email_address": "john.doe@example.com",
  "phone_number": "+1-212-555-4240"
}
```

## ⚠️ IMPACT

- **Website Bookings:** New customers cannot book appointments
- **Existing Customers:** Can book successfully (issue only affects new customer creation)
- **Error Rate:** Every booking attempt with a new phone number fails

## 🎯 VERIFICATION STEPS

After deploying the fix:

1. **Test New Customer Booking:**
   ```bash
   curl -X POST https://k-barbershop-backend-265357944939.us-east4.run.app/api/bookings \
     -H "Content-Type: application/json" \
     -d '{
       "customer_name": "Test User",
       "customer_phone": "+15551234567",
       "customer_email": "test@example.com",
       "barber_id": "TMKzhB-WjsDff5rr",
       "service_id": "7XPUHGDLY4N3H2OWTHMIABKF",
       "start_time": "2025-10-10T14:00:00Z"
     }'
   ```

2. **Check Logs:**
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=k-barbershop-backend AND severity>=ERROR" --limit=10 --format=json
   ```

3. **Verify Customer Created in Square:**
   - Log into Square Dashboard
   - Go to Customers section
   - Search for the test phone number

## 📍 WHERE IS THE CODE?

⚠️ **IMPORTANT:** The Python backend code (`k-barbershop-backend`) is **NOT** in the current GitHub repository (`kbarbershop/ai_receptionist`).

The `ai_receptionist` repository contains the Node.js server for ElevenLabs integration, which is separate and working correctly.

To fix this issue, you need to:
1. Locate the Python backend source code
2. Find `square_service.py`
3. Update line ~668 in the `create_or_find_customer` method
4. Rebuild and redeploy the Docker image to Cloud Run

## 🔄 DEPLOYMENT

After fixing `square_service.py`:

```bash
# Build new Docker image
gcloud builds submit --tag gcr.io/website-473417/k-barbershop-backend:latest

# Deploy to Cloud Run
gcloud run deploy k-barbershop-backend \
  --image gcr.io/website-473417/k-barbershop-backend:latest \
  --platform managed \
  --region us-east4 \
  --allow-unauthenticated
```

## 📊 LOGS ANALYSIS

The error has occurred multiple times:
- 2025-10-08 04:05:59 UTC
- 2025-10-08 00:33:53 UTC  
- 2025-10-07 22:40:44 UTC

All showing the exact same error pattern at `square_service.py:668`.

## ✅ SUCCESS CRITERIA

Fix is successful when:
- ✅ New customers can be created via booking form
- ✅ No "unrecognized field 'customer'" errors in logs
- ✅ Customer records appear in Square Dashboard
- ✅ Booking confirmation emails are sent

---

**Created:** 2025-10-08
**Priority:** 🔴 CRITICAL
**Status:** ⏳ Awaiting Fix Implementation
