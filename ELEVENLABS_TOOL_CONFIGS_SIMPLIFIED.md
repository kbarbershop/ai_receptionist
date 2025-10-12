# ElevenLabs Tool Configurations - SIMPLIFIED (Works with ElevenLabs)

**ISSUE RESOLVED:** ElevenLabs has trouble with array types. These simplified configs work around that limitation.

**Cloud Run URL:** `https://square-mcp-server-265357944939.us-east4.run.app`

**Total Tools:** 9 (including lookupCustomer for caller ID recognition)

---

## Tool 9: Lookup Customer (Caller ID Recognition) - NEW!

```json
{
  "type": "webhook",
  "name": "lookupCustomer",
  "description": "Check if a customer exists in Square by phone number. Use AFTER confirming phone number with caller. Returns customer info (name, email, phone) if found. Use for caller ID recognition flow: confirm phone → call this → use stored info if found.",
  "api_schema": {
    "url": "https://square-mcp-server-265357944939.us-east4.run.app/lookupCustomer",
    "method": "POST",
    "path_params_schema": [],
    "query_params_schema": [],
    "request_body_schema": {
      "id": "body",
      "type": "object",
      "description": "Customer lookup request",
      "required": true,
      "properties": [
        {
          "id": "customerPhone",
          "type": "string",
          "description": "Customer's phone number to search for. Can be any format - system handles normalization.",
          "dynamic_variable": "",
          "constant_value": "",
          "value_type": "llm_prompt",
          "required": true,
          "enum": null
        }
      ],
      "dynamic_variable": "",
      "constant_value": "",
      "value_type": "llm_prompt"
    },
    "request_headers": [],
    "auth_connection": null
  },
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  },
  "assignments": [],
  "disable_interruptions": false,
  "response_timeout_secs": 10,
  "force_pre_tool_speech": "auto"
}
```

**Response Format:**
```json
{
  "success": true,
  "found": true,
  "customer": {
    "id": "CUSTOMER_ID",
    "givenName": "John",
    "familyName": "Smith",
    "fullName": "John Smith",
    "phoneNumber": "+15551234567",
    "emailAddress": "john@example.com"
  }
}
```

Or if not found:
```json
{
  "success": true,
  "found": false
}
```

**Usage in Caller ID Flow:**
1. Customer states their need (book/reschedule/cancel)
2. Agent confirms phone: "I see you're calling from {{system_called_number}}. Is this the number for the appointment?"
3. Customer confirms
4. Agent calls lookupCustomer with confirmed number
5. If found: use stored info, don't ask for name/phone again
6. If NOT found: proceed without mentioning, collect info when needed

---

## ⚠️ Important Note About Arrays

ElevenLabs doesn't handle array types well in tool schemas. For multi-service bookings, we have two options:

### Option 1: Use Comma-Separated Strings (RECOMMENDED)

Modify the backend to accept comma-separated strings instead of arrays.

### Option 2: Create Separate Tools for Multi-Service

Create dedicated tools like `createMultiServiceBooking` that accept individual service parameters.

**I'll provide BOTH options below. Choose what works best for you.**

---

# OPTION 1: Comma-Separated String Format (RECOMMENDED)

## Backend Changes Needed

Update `src/routes/toolsRoutes.js` to handle comma-separated strings:

```javascript
// In createBooking route
if (serviceVariationIds) {
  // Handle both array and comma-separated string
  finalServiceIds = Array.isArray(serviceVariationIds) 
    ? serviceVariationIds 
    : serviceVariationIds.split(',').map(id => id.trim());
}

// In addServicesToBooking route  
if (serviceNames) {
  // Handle both array and comma-separated string
  const namesArray = Array.isArray(serviceNames)
    ? serviceNames
    : serviceNames.split(',').map(name => name.trim());
}
```

## Tool 3: Create Booking (String Format)

```json
{
  "type": "webhook",
  "name": "createBooking",
  "description": "Create a new appointment at K Barbershop. Can book ONE service or MULTIPLE services in a SINGLE appointment. For multiple services, provide serviceVariationIds as comma-separated string (e.g., 'ID1,ID2,ID3'). System calculates total duration and returns it - ALWAYS tell the customer the total time. Required: customerName, customerPhone, startTime, and either serviceVariationId (single) OR serviceVariationIds (multiple comma-separated). The response includes duration_minutes - inform customer of this total time.",
  "api_schema": {
    "url": "https://square-mcp-server-265357944939.us-east4.run.app/createBooking",
    "method": "POST",
    "path_params_schema": [],
    "query_params_schema": [],
    "request_body_schema": {
      "id": "body",
      "type": "object",
      "description": "Booking details",
      "required": true,
      "properties": [
        {
          "id": "customerName",
          "type": "string",
          "description": "Customer's full name (first and last)",
          "dynamic_variable": "",
          "constant_value": "",
          "value_type": "llm_prompt",
          "required": true,
          "enum": null
        },
        {
          "id": "customerPhone",
          "type": "string",
          "description": "Customer's phone number (10 digits)",
          "dynamic_variable": "",
          "constant_value": "",
          "value_type": "llm_prompt",
          "required": true,
          "enum": null
        },
        {
          "id": "customerEmail",
          "type": "string",
          "description": "Customer's email address (optional)",
          "dynamic_variable": "",
          "constant_value": "",
          "value_type": "llm_prompt",
          "required": false,
          "enum": null
        },
        {
          "id": "startTime",
          "type": "string",
          "description": "Appointment start time in ISO 8601 format with timezone (e.g., '2025-10-15T14:00:00-04:00')",
          "dynamic_variable": "",
          "constant_value": "",
          "value_type": "llm_prompt",
          "required": true,
          "enum": null
        },
        {
          "id": "serviceVariationId",
          "type": "string",
          "description": "Single service variation ID (use this for ONE service only). Example: '7XPUHGDLY4N3H2OWTHMIABKF' for Regular Haircut.",
          "dynamic_variable": "",
          "constant_value": "",
          "value_type": "llm_prompt",
          "required": false,
          "enum": null
        },
        {
          "id": "serviceVariationIds",
          "type": "string",
          "description": "COMMA-SEPARATED string of service variation IDs for MULTIPLE services. Example: '7XPUHGDLY4N3H2OWTHMIABKF,SPUX6LRBS6RHFBX3MSRASG2J' for Haircut + Beard Trim. NO SPACES after commas.",
          "dynamic_variable": "",
          "constant_value": "",
          "value_type": "llm_prompt",
          "required": false,
          "enum": null
        },
        {
          "id": "teamMemberId",
          "type": "string",
          "description": "Team member ID if customer requests specific barber (optional)",
          "dynamic_variable": "",
          "constant_value": "",
          "value_type": "llm_prompt",
          "required": false,
          "enum": null
        }
      ],
      "dynamic_variable": "",
      "constant_value": "",
      "value_type": "llm_prompt"
    },
    "request_headers": [],
    "auth_connection": null
  },
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  },
  "assignments": [],
  "disable_interruptions": false,
  "response_timeout_secs": 30,
  "force_pre_tool_speech": "auto"
}
```

## Tool 4: Add Services to Booking (String Format)

```json
{
  "type": "webhook",
  "name": "addServicesToBooking",
  "description": "Add additional services to an existing appointment. Use when customer wants to add services to their already-booked appointment. Provide bookingId and serviceNames as COMMA-SEPARATED string (e.g., 'Beard Trim,Ear Waxing'). Returns updated booking with new total duration.",
  "api_schema": {
    "url": "https://square-mcp-server-265357944939.us-east4.run.app/addServicesToBooking",
    "method": "POST",
    "path_params_schema": [],
    "query_params_schema": [],
    "request_body_schema": {
      "id": "body",
      "type": "object",
      "description": "Services to add to existing booking",
      "required": true,
      "properties": [
        {
          "id": "bookingId",
          "type": "string",
          "description": "The booking ID to add services to (get this from lookupBooking first)",
          "dynamic_variable": "",
          "constant_value": "",
          "value_type": "llm_prompt",
          "required": true,
          "enum": null
        },
        {
          "id": "serviceNames",
          "type": "string",
          "description": "COMMA-SEPARATED string of service names. Valid names: 'Regular Haircut', 'Beard Trim', 'Beard Sculpt', 'Ear Waxing', 'Nose Waxing', 'Eyebrow Waxing', 'Paraffin', 'Gold', 'Silver'. Example: 'Beard Trim,Ear Waxing' (NO SPACES after commas)",
          "dynamic_variable": "",
          "constant_value": "",
          "value_type": "llm_prompt",
          "required": true,
          "enum": null
        }
      ],
      "dynamic_variable": "",
      "constant_value": "",
      "value_type": "llm_prompt"
    },
    "request_headers": [],
    "auth_connection": null
  },
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  },
  "assignments": [],
  "disable_interruptions": false,
  "response_timeout_secs": 20,
  "force_pre_tool_speech": "auto"
}
```

---

# OPTION 2: Separate Parameters (Alternative)

## Tool 3b: Create Booking with Multiple Services (3 services max)

```json
{
  "type": "webhook",
  "name": "createBooking",
  "description": "Create a new appointment at K Barbershop. Can book up to 3 services in ONE appointment. Provide service1Id (required), and optionally service2Id and service3Id for multiple services. System calculates total duration - ALWAYS tell customer the total time from duration_minutes in response.",
  "api_schema": {
    "url": "https://square-mcp-server-265357944939.us-east4.run.app/createBooking",
    "method": "POST",
    "path_params_schema": [],
    "query_params_schema": [],
    "request_body_schema": {
      "id": "body",
      "type": "object",
      "description": "Booking details",
      "required": true,
      "properties": [
        {
          "id": "customerName",
          "type": "string",
          "description": "Customer's full name",
          "value_type": "llm_prompt",
          "required": true
        },
        {
          "id": "customerPhone",
          "type": "string",
          "description": "Customer's phone number",
          "value_type": "llm_prompt",
          "required": true
        },
        {
          "id": "startTime",
          "type": "string",
          "description": "Appointment start time (ISO 8601 format)",
          "value_type": "llm_prompt",
          "required": true
        },
        {
          "id": "service1Id",
          "type": "string",
          "description": "First service ID (REQUIRED). Example: '7XPUHGDLY4N3H2OWTHMIABKF' for Haircut",
          "value_type": "llm_prompt",
          "required": true
        },
        {
          "id": "service2Id",
          "type": "string",
          "description": "Second service ID (OPTIONAL). Leave empty if only one service.",
          "value_type": "llm_prompt",
          "required": false
        },
        {
          "id": "service3Id",
          "type": "string",
          "description": "Third service ID (OPTIONAL). Leave empty if less than 3 services.",
          "value_type": "llm_prompt",
          "required": false
        }
      ]
    },
    "request_headers": [],
    "auth_connection": null
  },
  "response_timeout_secs": 30
}
```

**Backend changes needed for Option 2:**

```javascript
// In src/routes/toolsRoutes.js
const { service1Id, service2Id, service3Id, serviceVariationId, serviceVariationIds } = req.body;

let finalServiceIds;
if (service1Id) {
  // Handle separate service parameters
  finalServiceIds = [service1Id];
  if (service2Id) finalServiceIds.push(service2Id);
  if (service3Id) finalServiceIds.push(service3Id);
} else if (serviceVariationIds) {
  // ... existing code
}
```

---

# Which Option Should You Use?

## 🏆 **OPTION 1 (Comma-Separated) - RECOMMENDED**

**Pros:**
- More flexible (unlimited services)
- Cleaner tool schema
- Easier for AI to construct

**Cons:**
- Requires small backend change
- AI must format string correctly

**Best for:** Production use, scalability

## 🔧 **OPTION 2 (Separate Parameters)**

**Pros:**
- No string parsing needed
- Each parameter is explicit
- Works immediately

**Cons:**
- Limited to 3 services
- More complex schema
- More parameters to manage

**Best for:** Quick fix, testing

---

# Implementation Instructions

## For Option 1 (Recommended):

### Step 1: Update Backend

Add this code to `src/routes/toolsRoutes.js` in the `createBooking` route:

```javascript
// Around line 115, replace the serviceVariationIds handling
let finalServiceIds;

if (serviceVariationIds && Array.isArray(serviceVariationIds) && serviceVariationIds.length > 0) {
  // Array format (direct)
  finalServiceIds = serviceVariationIds;
  console.log(`🎯 Multi-service booking: ${serviceVariationIds.length} services (array)`);
} else if (serviceVariationIds && typeof serviceVariationIds === 'string') {
  // Comma-separated string format (from ElevenLabs)
  finalServiceIds = serviceVariationIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
  console.log(`🎯 Multi-service booking: ${finalServiceIds.length} services (string)`);
} else if (serviceVariationId) {
  // Single service (backward compatible)
  finalServiceIds = [serviceVariationId];
  console.log(`🎯 Single-service booking`);
} else {
  return res.status(400).json({
    success: false,
    error: 'Missing required field: serviceVariationId or serviceVariationIds'
  });
}
```

And for `addServicesToBooking` around line 160:

```javascript
let serviceNames = req.body.serviceNames;

// Handle both array and comma-separated string
if (typeof serviceNames === 'string') {
  serviceNames = serviceNames.split(',').map(name => name.trim()).filter(name => name.length > 0);
}

if (!Array.isArray(serviceNames) || serviceNames.length === 0) {
  return res.status(400).json({
    success: false,
    error: 'serviceNames must be a comma-separated string or array'
  });
}
```

### Step 2: Deploy Backend

```bash
git add src/routes/toolsRoutes.js
git commit -m "Support comma-separated strings for ElevenLabs array compatibility"
git push
gcloud run deploy ai-receptionist --source .
```

### Step 3: Add Tools to ElevenLabs

Use the JSON from **Tool 3**, **Tool 4**, and **Tool 9** (lookupCustomer) in Option 1 above.

---

# Testing

## Test Customer Lookup

```bash
curl -X POST https://square-mcp-server-265357944939.us-east4.run.app/lookupCustomer \
  -H "Content-Type: application/json" \
  -d '{
    "customerPhone": "5715276016"
  }'
```

**Expected if found:**
```json
{
  "success": true,
  "found": true,
  "customer": {
    "id": "...",
    "givenName": "John",
    "familyName": "Smith",
    "fullName": "John Smith",
    "phoneNumber": "+15715276016",
    "emailAddress": "john@example.com"
  }
}
```

**Expected if not found:**
```json
{
  "success": true,
  "found": false
}
```

## Test Multi-Service Booking

```bash
curl -X POST https://square-mcp-server-265357944939.us-east4.run.app/createBooking \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Test User",
    "customerPhone": "5551234567",
    "startTime": "2025-10-15T14:00:00-04:00",
    "serviceVariationIds": "7XPUHGDLY4N3H2OWTHMIABKF,SPUX6LRBS6RHFBX3MSRASG2J"
  }'
```

**Expected:** Booking created with 2 services, 60 minutes total

## Test Add Services

```bash
curl -X POST https://square-mcp-server-265357944939.us-east4.run.app/addServicesToBooking \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "your-booking-id",
    "serviceNames": "Beard Trim,Ear Waxing"
  }'
```

**Expected:** Services added successfully

---

**Version:** 2.9.0  
**Issue:** ElevenLabs array type compatibility  
**Solution:** Comma-separated strings + lookupCustomer for caller ID  
**Status:** Ready to implement
