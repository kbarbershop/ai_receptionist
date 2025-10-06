# ElevenLabs Tool Configurations (JSON Format) - CORRECTED

Copy and paste these JSON configurations when setting up each tool in ElevenLabs.

**IMPORTANT:** Required fields are marked and must be filled by the agent.

---

## Tool 1: Check Availability

**All fields optional** - can check all availability or filter by date/service

```json
{
  "type": "webhook",
  "name": "checkAvailability",
  "description": "Check available appointment time slots for the next 7 days. Use this before booking to show customers their options. Always check availability before suggesting alternative times.",
  "api_schema": {
    "url": "https://square-mcp-server-265357944939.us-east4.run.app/tools/getAvailability",
    "method": "POST",
    "path_params_schema": [],
    "query_params_schema": [],
    "request_body_schema": {
      "id": "body",
      "type": "object",
      "description": "Request body for checking availability",
      "required": false,
      "properties": [
        {
          "id": "startDate",
          "type": "string",
          "description": "Start date in YYYY-MM-DD format. Leave empty to start from today. Example: 2025-10-15",
          "dynamic_variable": "",
          "constant_value": "",
          "value_type": "llm_prompt",
          "required": false,
          "enum": null
        },
        {
          "id": "serviceVariationId",
          "type": "string",
          "description": "Specific service ID if customer knows what they want. Leave empty to show all available services.",
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

## Tool 2: Create Booking

**REQUIRED: customerName, customerPhone, startTime, serviceVariationId**

```json
{
  "type": "webhook",
  "name": "createBooking",
  "description": "Create a new appointment booking. REQUIRED fields: customerName, customerPhone, startTime, serviceVariationId. Always ask for customer name, phone number, and preferred time before calling this. Confirm all details with customer before booking. Use this only after checking availability first.",
  "api_schema": {
    "url": "https://square-mcp-server-265357944939.us-east4.run.app/tools/createBooking",
    "method": "POST",
    "path_params_schema": [],
    "query_params_schema": [],
    "request_body_schema": {
      "id": "body",
      "type": "object",
      "description": "Request body for creating booking",
      "required": true,
      "properties": [
        {
          "id": "customerName",
          "type": "string",
          "description": "REQUIRED. Customer's full name (first and last name). Example: John Smith",
          "dynamic_variable": "",
          "constant_value": "",
          "value_type": "llm_prompt",
          "required": true,
          "enum": null
        },
        {
          "id": "customerPhone",
          "type": "string",
          "description": "REQUIRED. Customer's phone number including area code. Format: 10 digits. Example: 5551234567",
          "dynamic_variable": "",
          "constant_value": "",
          "value_type": "llm_prompt",
          "required": true,
          "enum": null
        },
        {
          "id": "customerEmail",
          "type": "string",
          "description": "OPTIONAL. Customer's email address. Example: john@example.com",
          "dynamic_variable": "",
          "constant_value": "",
          "value_type": "llm_prompt",
          "required": false,
          "enum": null
        },
        {
          "id": "startTime",
          "type": "string",
          "description": "REQUIRED. Appointment start time in ISO 8601 format with timezone. CRITICAL: Must include UTC offset for EST/EDT. Format: YYYY-MM-DDTHH:MM:SS-05:00 (EST) or YYYY-MM-DDTHH:MM:SS-04:00 (EDT). Example: 2025-10-15T14:00:00-04:00",
          "dynamic_variable": "",
          "constant_value": "",
          "value_type": "llm_prompt",
          "required": true,
          "enum": null
        },
        {
          "id": "serviceVariationId",
          "type": "string",
          "description": "REQUIRED. The service variation ID from Square. Get this from the availability check results. Required to create booking.",
          "dynamic_variable": "",
          "constant_value": "",
          "value_type": "llm_prompt",
          "required": true,
          "enum": null
        },
        {
          "id": "teamMemberId",
          "type": "string",
          "description": "OPTIONAL. Specific barber/team member ID if customer has a preference. Leave empty for auto-assignment. Get from availability results.",
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

## Tool 3: Lookup Booking

**REQUIRED: customerPhone**

```json
{
  "type": "webhook",
  "name": "lookupBooking",
  "description": "Find existing appointments by customer's phone number. REQUIRED field: customerPhone. Use this when customer wants to reschedule, cancel, or check their appointment. Always look up before rescheduling or canceling.",
  "api_schema": {
    "url": "https://square-mcp-server-265357944939.us-east4.run.app/tools/lookupBooking",
    "method": "POST",
    "path_params_schema": [],
    "query_params_schema": [],
    "request_body_schema": {
      "id": "body",
      "type": "object",
      "description": "Request body for looking up bookings",
      "required": true,
      "properties": [
        {
          "id": "customerPhone",
          "type": "string",
          "description": "REQUIRED. Customer's phone number to search for bookings. Format: 10 digits. Example: 5551234567",
          "dynamic_variable": "",
          "constant_value": "",
          "value_type": "llm_prompt",
          "required": true,
          "enum": null
        },
        {
          "id": "customerName",
          "type": "string",
          "description": "OPTIONAL. Customer's name for additional verification. Helps confirm correct customer.",
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

## Tool 4: Reschedule Booking

**REQUIRED: bookingId, newStartTime**

```json
{
  "type": "webhook",
  "name": "rescheduleBooking",
  "description": "Change the time of an existing appointment. REQUIRED fields: bookingId, newStartTime. First use lookupBooking to get the booking ID, verify customer identity, check new availability, then use this tool with the new time. Always confirm changes with customer before executing.",
  "api_schema": {
    "url": "https://square-mcp-server-265357944939.us-east4.run.app/tools/rescheduleBooking",
    "method": "POST",
    "path_params_schema": [],
    "query_params_schema": [],
    "request_body_schema": {
      "id": "body",
      "type": "object",
      "description": "Request body for rescheduling booking",
      "required": true,
      "properties": [
        {
          "id": "bookingId",
          "type": "string",
          "description": "REQUIRED. The booking ID from the lookupBooking results. This uniquely identifies which appointment to reschedule.",
          "dynamic_variable": "",
          "constant_value": "",
          "value_type": "llm_prompt",
          "required": true,
          "enum": null
        },
        {
          "id": "newStartTime",
          "type": "string",
          "description": "REQUIRED. New appointment time in ISO 8601 format with timezone. CRITICAL: Must include UTC offset for EST/EDT. Format: YYYY-MM-DDTHH:MM:SS-05:00 (EST) or YYYY-MM-DDTHH:MM:SS-04:00 (EDT). Example: 2025-10-15T14:00:00-04:00",
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
  "response_timeout_secs": 30,
  "force_pre_tool_speech": "auto"
}
```

---

## Tool 5: Cancel Booking

**REQUIRED: bookingId**

```json
{
  "type": "webhook",
  "name": "cancelBooking",
  "description": "Cancel an existing appointment. REQUIRED field: bookingId. First use lookupBooking to get the booking ID and verify customer identity. Ask customer to confirm cancellation before proceeding. This action cannot be undone.",
  "api_schema": {
    "url": "https://square-mcp-server-265357944939.us-east4.run.app/tools/cancelBooking",
    "method": "POST",
    "path_params_schema": [],
    "query_params_schema": [],
    "request_body_schema": {
      "id": "body",
      "type": "object",
      "description": "Request body for canceling booking",
      "required": true,
      "properties": [
        {
          "id": "bookingId",
          "type": "string",
          "description": "REQUIRED. The booking ID to cancel. Get this from lookupBooking results. This uniquely identifies which appointment to cancel.",
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

## Required Fields Summary

| Tool | Required Fields |
|------|----------------|
| **checkAvailability** | None (all optional) |
| **createBooking** | `customerName`, `customerPhone`, `startTime`, `serviceVariationId` |
| **lookupBooking** | `customerPhone` |
| **rescheduleBooking** | `bookingId`, `newStartTime` |
| **cancelBooking** | `bookingId` |

---

## Setup Instructions

1. Go to your ElevenLabs agent → **Agent** section → **Tools**
2. Click **"Add Tool"**
3. Select **"Webhook"** as Tool Type
4. Copy and paste each JSON configuration above (one at a time)
5. **Verify required fields are marked** in the ElevenLabs UI
6. Save each tool

**Important Notes:**
- All tools use **POST** method
- All tools use **no authentication** (auth_connection: null)
- Server URL is already configured in each JSON
- Test each tool after adding to verify it works

---

## Tool Usage Order

**For new bookings:**
1. checkAvailability → 2. createBooking

**For rescheduling:**
1. lookupBooking → 2. checkAvailability → 3. rescheduleBooking

**For canceling:**
1. lookupBooking → 2. cancelBooking

---

## Troubleshooting

**Tool not being called:**
- Check tool name matches exactly
- Verify description is clear and specific
- Ensure required fields are marked
- Update system prompt with tool usage instructions

**Tool returns error:**
- Check server is running: `curl https://square-mcp-server-265357944939.us-east4.run.app/health`
- Verify required fields are provided
- Check parameter format (especially startTime - must include timezone)
- Look at Cloud Run logs: `gcloud run logs read square-mcp-server --region us-east4`

**Missing required fields:**
- Agent should collect required info BEFORE calling tool
- Update system prompt to emphasize gathering all required fields
- Tool descriptions now include "REQUIRED" in descriptions

**Wrong data being sent:**
- Review tool description in JSON config
- Make parameter descriptions more specific
- Add examples in parameter descriptions
- Update system prompt with parameter format examples
