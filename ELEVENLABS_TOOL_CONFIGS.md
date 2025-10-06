# ElevenLabs Tool Configurations (JSON Format) - 6 TOOLS

Copy and paste these JSON configurations when setting up each tool in ElevenLabs.

**UPDATED:** Replaced 3 separate tools with 1 unified **generalInquiry** tool.

---

## Tool 1: Check Availability

[Previous content remains the same...]

## Tool 2: Create Booking

[Previous content remains the same...]

## Tool 3: Lookup Booking

[Previous content remains the same...]

## Tool 4: Reschedule Booking

[Previous content remains the same...]

## Tool 5: Cancel Booking

[Previous content remains the same...]

---

## Tool 6: General Inquiry ⭐ NEW - ALL-IN-ONE

**Handles: Business hours, services/pricing, and team members in one call**

```json
{
  "type": "webhook",
  "name": "generalInquiry",
  "description": "Get information about K Barbershop from Square. This tool can answer questions about: (1) Business hours - when open/closed, daily hours, timezone, address, phone number. (2) Services & Pricing - what services are offered, how much they cost, how long they take. (3) Staff & Barbers - who works there, barber names. Use this for ANY general question about the business. The tool automatically returns relevant information based on the question context. You can optionally specify inquiryType (hours/services/staff) or leave it empty to get all information.",
  "api_schema": {
    "url": "https://square-mcp-server-265357944939.us-east4.run.app/tools/generalInquiry",
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

## Required Fields Summary

| Tool | Required Fields | Optional Fields |
|------|----------------|-----------------|
| **checkAvailability** | None | `startDate`, `serviceVariationId` |
| **createBooking** | `customerName`, `customerPhone`, `startTime`, `serviceVariationId` | `customerEmail`, `teamMemberId` |
| **lookupBooking** | `customerPhone` | `customerName` |
| **rescheduleBooking** | `bookingId`, `newStartTime` | None |
| **cancelBooking** | `bookingId` | None |
| **generalInquiry** ⭐ | None | `inquiryType` |

---

## How generalInquiry Works

### Smart Auto-Detection
The LLM can optionally specify `inquiryType`, but if left empty, the tool returns **all information**:
- Business hours & location
- Services & pricing
- Team members

### Inquiry Type Options

| inquiryType Value | Returns | Use When Customer Asks |
|-------------------|---------|----------------------|
| `"hours"` or `"location"` | Business hours, timezone, address, phone | "What time do you close?", "Where are you located?" |
| `"services"` or `"pricing"` | All services with prices and durations | "How much is a haircut?", "What services do you offer?" |
| `"staff"` or `"barbers"` or `"team"` | List of all barbers/team members | "Who works there?", "Can I book with John?" |
| Empty (no parameter) | Everything above | Any general question |

### Example Responses

**Customer asks: "What time do you close?"**
- Agent calls: `generalInquiry` with `inquiryType: "hours"`
- Returns: Business hours, address, phone

**Customer asks: "How much is a haircut?"**
- Agent calls: `generalInquiry` with `inquiryType: "services"`
- Returns: All services with pricing

**Customer asks: "Tell me about your shop"**
- Agent calls: `generalInquiry` with no parameters
- Returns: Hours + Services + Staff (everything)

---

## Setup Instructions

1. Go to your ElevenLabs agent → **Agent** section → **Tools**
2. Click **"Add Tool"** for each tool (6 total now, not 8)
3. Select **"Webhook"** as Tool Type
4. Copy and paste each JSON configuration above
5. **Verify required fields are marked** in the ElevenLabs UI
6. Save each tool
7. **Test the generalInquiry tool**

---

## Tool Usage Examples

### Using generalInquiry

**Example 1: Hours question**
```
Customer: "What time do you close today?"
Agent: [Calls generalInquiry with inquiryType: "hours"]
Response: { businessHours: {...}, timezone: "America/New_York", address: {...} }
Agent: "We're open until 7pm today!"
```

**Example 2: Pricing question**
```
Customer: "How much is a haircut?"
Agent: [Calls generalInquiry with inquiryType: "services"]
Response: { services: [{name: "Men's Haircut", price: "30.00", ...}] }
Agent: "Our men's haircut is $30 and takes about 30 minutes."
```

**Example 3: Staff question**
```
Customer: "Can I book with John?"
Agent: [Calls generalInquiry with inquiryType: "staff"]
Response: { teamMembers: [{fullName: "John Smith", ...}] }
Agent: "Yes, John is available! What day works for you?"
```

**Example 4: General question**
```
Customer: "Tell me about your barbershop"
Agent: [Calls generalInquiry with no parameters]
Response: { businessHours: {...}, services: [...], teamMembers: [...] }
Agent: "We're located in Great Falls Plaza, open Tue-Sat 10am-7pm. We offer haircuts, beard trims, and styling services. Our team includes John, Mike, and Sarah."
```

---

## Troubleshooting

**Tool not being called:**
- Check tool name is exactly "generalInquiry"
- Verify description mentions hours, services, AND staff
- Update system prompt to reference this unified tool

**Tool returns partial data:**
- Normal! It only returns what Square has configured
- Check Square Dashboard for missing data (services, team members, hours)

**inquiryType not working:**
- Make it optional - agent can call without it
- Tool works fine with no parameters (returns everything)

---

## Next Steps

1. **Redeploy server:** `cd ~/square-mcp-server-deploy && git pull && ./deploy.sh`
2. **Add only 6 tools** to ElevenLabs (not 8)
3. **Update system prompt** to reference generalInquiry
4. **Test:** Ask about hours, pricing, and staff

**Much simpler than 3 separate tools! 🎉**
