# ElevenLabs Tool Configurations - v2.9.0 (8 TOOLS)

Copy and paste these JSON configurations when setting up each tool in ElevenLabs.

**UPDATED for v2.9.0:** Enhanced `createBooking` with multi-service support!

---

## Tool 1: Get Current Date/Time

**Purpose:** Provides current date/time context for relative dates ("tomorrow", "thursday", etc.)

```json
{
  "type": "webhook",
  "name": "getCurrentDateTime",
  "description": "Get the current date and time in Eastern Time (America/New_York timezone) with context for relative dates. Use this at the START of EVERY conversation to understand what 'tomorrow', 'thursday', 'next week' means. Returns current date/time, what tomorrow is, and what next Thursday is. Always call this first before asking about availability or booking appointments.",
  "api_schema": {
    "url": "https://your-cloud-run-url.run.app/getCurrentDateTime",
    "method": "POST",
    "path_params_schema": [],
    "query_params_schema": [],
    "request_body_schema": {
      "id": "body",
      "type": "object",
      "description": "No parameters needed",
      "required": false,
      "properties": [],
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

---

## Tool 2: Check Availability

**Purpose:** Check available appointment slots

```json
{
  "type": "webhook",
  "name": "getAvailability",
  "description": "Check available appointment times for K Barbershop. Use this BEFORE creating any booking to verify the requested time is available. Can check availability for a specific date (startDate in YYYY-MM-DD format) or a specific date and time (datetime in ISO 8601 format like 2025-10-15T14:00:00-04:00). Returns list of available time slots.",
  "api_schema": {
    "url": "https://your-cloud-run-url.run.app/getAvailability",
    "method": "POST",
    "path_params_schema": [],
    "query_params_schema": [],
    "request_body_schema": {
      "id": "body",
      "type": "object",
      "description": "Parameters for availability check",
      "required": false,
      "properties": [
        {
          "id": "startDate",
          "type": "string",
          "description": "Date to check availability in YYYY-MM-DD format (e.g., '2025-10-15'). Use this for date-only searches.",
          "dynamic_variable": "",
          "constant_value": "",
          "value_type": "llm_prompt",
          "required": false,
          "enum": null
        },
        {
          "id": "datetime",
          "type": "string",
          "description": "Specific date and time in ISO 8601 format with timezone (e.g., '2025-10-15T14:00:00-04:00' for 2pm Eastern Time). Use this when customer requests a specific time.",
          "dynamic_variable": "",
          "constant_value": "",
          "value_type": "llm_prompt",
          "required": false,
          "enum": null
        },
        {
          "id": "serviceVariationId",
          "type": "string",
          "description": "Service variation ID from Square catalog. Required for accurate duration-based availability.",
          "dynamic_variable": "",
          "constant_value": "",
          "value_type": "llm_prompt",
          "required": false,
          "enum": null
        },
        {
          "id": "teamMemberId",
          "type": "string",
          "description": "Optional team member ID if customer requests specific barber.",
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
  "response_timeout_secs": 20,
  "force_pre_tool_speech": "auto"
}
```

---

## Tool 3: Create Booking ⭐ ENHANCED IN v2.9.0

**Purpose:** Create new appointment with one or multiple services

```json
{
  "type": "webhook",
  "name": "createBooking",
  "description": "Create a new appointment at K Barbershop. Can book ONE service or MULTIPLE services in a SINGLE appointment. When customer wants multiple services (e.g., 'haircut and beard trim'), use serviceVariationIds array to book them together. System calculates total duration and returns it - ALWAYS tell the customer the total time. Required: customerName, customerPhone, startTime, and either serviceVariationId (single) OR serviceVariationIds (multiple). The response includes duration_minutes - inform customer of this total time.",
  "api_schema": {
    "url": "https://your-cloud-run-url.run.app/createBooking",
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
          "type": "array",
          "description": "Array of service variation IDs for MULTIPLE services in ONE appointment. Example: ['7XPUHGDLY4N3H2OWTHMIABKF', 'SPUX6LRBS6RHFBX3MSRASG2J'] for Haircut + Beard Trim. Use this when customer wants multiple services together.",
          "dynamic_variable": "",
          "constant_value": "",
          "value_type": "llm_prompt",
          "required": false,
          "items": {
            "type": "string"
          },
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

---

## Tool 4: Add Services to Booking

**Purpose:** Add one or more services to an existing appointment

```json
{
  "type": "webhook",
  "name": "addServicesToBooking",
  "description": "Add additional services to an existing appointment. Use when customer wants to add services to their already-booked appointment. Checks for conflicts with next appointments. If services would overlap with next customer, returns error. Provide bookingId and array of service names (not IDs). Example service names: 'Beard Trim', 'Ear Waxing', 'Eyebrow Waxing'. Returns updated booking with new total duration.",
  "api_schema": {
    "url": "https://your-cloud-run-url.run.app/addServicesToBooking",
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
          "type": "array",
          "description": "Array of service NAMES (not IDs) to add. Valid names: 'Regular Haircut', 'Beard Trim', 'Beard Sculpt', 'Ear Waxing', 'Nose Waxing', 'Eyebrow Waxing', 'Paraffin', 'Gold', 'Silver'. Example: ['Beard Trim', 'Ear Waxing']",
          "dynamic_variable": "",
          "constant_value": "",
          "value_type": "llm_prompt",
          "required": true,
          "items": {
            "type": "string"
          },
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

## Tool 5: Lookup Booking

**Purpose:** Find customer's appointments by phone number

```json
{
  "type": "webhook",
  "name": "lookupBooking",
  "description": "Look up existing appointments for a customer using their phone number. Returns all upcoming bookings including active and cancelled ones. Use this to find a customer's appointment before rescheduling, canceling, or adding services. Returns booking IDs, dates, times, and services.",
  "api_schema": {
    "url": "https://your-cloud-run-url.run.app/lookupBooking",
    "method": "POST",
    "path_params_schema": [],
    "query_params_schema": [],
    "request_body_schema": {
      "id": "body",
      "type": "object",
      "description": "Customer lookup details",
      "required": true,
      "properties": [
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
          "id": "customerName",
          "type": "string",
          "description": "Customer's name (optional, for verification)",
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
  "response_timeout_secs": 20,
  "force_pre_tool_speech": "auto"
}
```

---

## Tool 6: Reschedule Booking

**Purpose:** Change appointment to new date/time

```json
{
  "type": "webhook",
  "name": "rescheduleBooking",
  "description": "Change an existing appointment to a new date and time. Use lookupBooking first to get the booking ID. Validates new time doesn't overlap with other appointments. Checks that total appointment duration (all services) fits in new time slot. Returns updated booking confirmation.",
  "api_schema": {
    "url": "https://your-cloud-run-url.run.app/rescheduleBooking",
    "method": "POST",
    "path_params_schema": [],
    "query_params_schema": [],
    "request_body_schema": {
      "id": "body",
      "type": "object",
      "description": "Reschedule details",
      "required": true,
      "properties": [
        {
          "id": "bookingId",
          "type": "string",
          "description": "The booking ID to reschedule (get from lookupBooking)",
          "dynamic_variable": "",
          "constant_value": "",
          "value_type": "llm_prompt",
          "required": true,
          "enum": null
        },
        {
          "id": "newStartTime",
          "type": "string",
          "description": "New appointment start time in ISO 8601 format with timezone (e.g., '2025-10-15T14:00:00-04:00')",
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

## Tool 7: Cancel Booking

**Purpose:** Cancel an appointment

```json
{
  "type": "webhook",
  "name": "cancelBooking",
  "description": "Cancel an existing appointment. Use lookupBooking first to get the booking ID. Always verify customer identity and confirm they want to cancel before calling this. Returns cancellation confirmation.",
  "api_schema": {
    "url": "https://your-cloud-run-url.run.app/cancelBooking",
    "method": "POST",
    "path_params_schema": [],
    "query_params_schema": [],
    "request_body_schema": {
      "id": "body",
      "type": "object",
      "description": "Cancellation details",
      "required": true,
      "properties": [
        {
          "id": "bookingId",
          "type": "string",
          "description": "The booking ID to cancel (get from lookupBooking)",
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

## Tool 8: General Inquiry

**Purpose:** Get business information (hours, services, staff)

```json
{
  "type": "webhook",
  "name": "generalInquiry",
  "description": "Get information about K Barbershop from Square. This tool can answer questions about: (1) Business hours - when open/closed, daily hours, timezone, address, phone number. (2) Services & Pricing - what services are offered, how much they cost, how long they take. (3) Staff & Barbers - who works there, barber names. Use this for ANY general question about the business. The tool automatically returns relevant information based on the question context. You can optionally specify inquiryType (hours/services/staff) or leave it empty to get all information.",
  "api_schema": {
    "url": "https://your-cloud-run-url.run.app/generalInquiry",
    "method": "POST",
    "path_params_schema": [],
    "query_params_schema": [],
    "request_body_schema": {
      "id": "body",
      "type": "object",
      "description": "Optional parameter to filter what information to return",
      "required": false,
      "properties": [
        {
          "id": "inquiryType",
          "type": "string",
          "description": "OPTIONAL. Specify what type of information needed: 'hours' for business hours/location, 'services' or 'pricing' for services and prices, 'staff' or 'barbers' or 'team' for team members. Leave empty to get all information. Examples: Use 'hours' when customer asks 'what time do you close?', use 'services' when they ask 'how much is a haircut?', use 'staff' when they ask 'who works there?'",
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
  "response_timeout_secs": 20,
  "force_pre_tool_speech": "auto"
}
```

---

## Service Variation IDs Reference

Use these IDs in `createBooking` tool:

```
Regular Haircut:  7XPUHGDLY4N3H2OWTHMIABKF ($35, 30min)
Beard Trim:       SPUX6LRBS6RHFBX3MSRASG2J ($25, 30min)
Beard Sculpt:     UH5JRVCJGAB2KISNBQ7KMVVQ ($30, 30min)
Ear Waxing:       ALZZEN4DO6JCNMC6YPXN6DPH ($15, 10min)
Nose Waxing:      VVGK7I7L6BHTG7LFKLAIRHBZ ($15, 10min)
Eyebrow Waxing:   3TV5CVRXCB62BWIWVY6OCXIC ($15, 10min)
Paraffin:         7ND6OIFTRLJEPMDBBI3B3ELT ($25, 30min)
Gold Package:     7UKWUIF4CP7YR27FI52DWPEN ($70, 90min)
Silver Package:   7PFUQVFMALHIPDAJSYCBKBYV ($50, 60min)
```

---

## Setup Instructions

1. Go to your ElevenLabs agent → **Agent** section → **Tools**
2. Click **"Add Tool"** for each tool (8 total)
3. Select **"Webhook"** as Tool Type
4. Copy and paste each JSON configuration above
5. **IMPORTANT:** Replace `https://your-cloud-run-url.run.app` with your actual Cloud Run URL in ALL tools
6. **Verify required fields are marked** in the ElevenLabs UI
7. Save each tool
8. Test each tool with sample inputs

---

## Tool Usage Examples

### Multi-Service Booking (NEW in v2.9.0)

```
Customer: "I want a haircut and beard trim tomorrow at 2pm"

Agent calls:
1. getCurrentDateTime → Gets tomorrow's date
2. getAvailability → Checks 2pm tomorrow
3. createBooking with:
   {
     "customerName": "John Smith",
     "customerPhone": "5551234567",
     "startTime": "2025-10-08T14:00:00-04:00",
     "serviceVariationIds": [
       "7XPUHGDLY4N3H2OWTHMIABKF",  // Haircut
       "SPUX6LRBS6RHFBX3MSRASG2J"   // Beard Trim
     ]
   }

Response includes: duration_minutes: 60

Agent says: "Perfect! You're all set for tomorrow at 2pm. That'll be 60 minutes total for your haircut and beard trim."
```

### Adding Services

```
Customer: "I have an appointment tomorrow. Can I add a beard trim?"

Agent calls:
1. lookupBooking → Finds booking ID
2. addServicesToBooking with:
   {
     "bookingId": "abc123",
     "serviceNames": ["Beard Trim"]
   }

Agent says: "Perfect! I've added the beard trim. Your appointment will now take 60 minutes total."
```

---

## Troubleshooting

**"addServicesToBooking not found"**
- Make sure you added ALL 8 tools
- Tool name must be exactly "addServicesToBooking"
- URL must point to your Cloud Run deployment

**"serviceVariationIds not working"**
- Make sure tool schema includes array type for serviceVariationIds
- Items must be type "string"
- ElevenLabs should serialize as JSON array

**"Duration not mentioned to customer"**
- Verify system prompt instructs AI to read duration_minutes from response
- Check createBooking response includes this field
- Update prompt: "Always say: That'll be X minutes total"

---

**Version:** 2.9.0  
**Last Updated:** October 12, 2025  
**Next:** Copy system prompt from ELEVENLABS_SYSTEM_PROMPT.md
