# ElevenLabs Server Tools Integration Guide

## ✅ Server Updated (Oct 6, 2025)
Your Square booking server has been converted to ElevenLabs Server Tools format.

**Server URL:** `https://square-mcp-server-265357944939.us-east4.run.app`

---

## 🔧 Step 1: Redeploy to Google Cloud Run

Your server code is updated on GitHub. Now redeploy:

```bash
cd ~/square-mcp-server-deploy
git pull origin main

# Rebuild Docker image
docker build --platform linux/amd64 --no-cache -t gcr.io/website-473417/square-mcp-server:latest .

# Push to Google Container Registry
docker push gcr.io/website-473417/square-mcp-server:latest

# Deploy to Cloud Run
gcloud run deploy square-mcp-server \
  --image gcr.io/website-473417/square-mcp-server:latest \
  --platform managed \
  --region us-east4 \
  --allow-unauthenticated \
  --set-env-vars SQUARE_ACCESS_TOKEN=EAAAl6DLAw75VQSm6qSi4cwNA_Y10kPC4ZtycW-GikXXgDbapqr9aipErTiaXqMr,SQUARE_LOCATION_ID=LCS4MXPZP8J3M
```

---

## 🤖 Step 2: Configure ElevenLabs Agent

### Access Your Agent Settings
1. Go to ElevenLabs dashboard
2. Select your AI receptionist agent
3. Navigate to **Agent** section → **Tools**

### Add Each Tool (5 Total)

For each tool below, click **"Add Tool"** → Select **"Webhook"** type:

---

### Tool 1: Check Availability

**Configuration:**
- **Name:** `checkAvailability`
- **Description:** `Check available appointment time slots for the next 7 days. Use this before booking to show customers their options.`
- **URL:** `https://square-mcp-server-265357944939.us-east4.run.app/tools/getAvailability`
- **Method:** `POST`
- **Authentication:** None

**Body Parameters:**
```json
{
  "startDate": {
    "type": "string",
    "description": "Start date in YYYY-MM-DD format. Leave empty to start from today.",
    "required": false
  },
  "serviceVariationId": {
    "type": "string", 
    "description": "Specific service ID if customer knows what they want. Leave empty to show all services.",
    "required": false
  }
}
```

---

### Tool 2: Create Booking

**Configuration:**
- **Name:** `createBooking`
- **Description:** `Create a new appointment booking. Always ask for customer name, phone number, and preferred time before calling this. Confirm all details with customer before booking.`
- **URL:** `https://square-mcp-server-265357944939.us-east4.run.app/tools/createBooking`
- **Method:** `POST`
- **Authentication:** None

**Body Parameters:**
```json
{
  "customerName": {
    "type": "string",
    "description": "Customer's full name (first and last name)",
    "required": true
  },
  "customerPhone": {
    "type": "string",
    "description": "Customer's phone number including area code",
    "required": true
  },
  "customerEmail": {
    "type": "string",
    "description": "Customer's email address (optional)",
    "required": false
  },
  "startTime": {
    "type": "string",
    "description": "Appointment start time in ISO 8601 format (e.g., 2025-10-15T14:00:00Z). Convert from customer's requested time.",
    "required": true
  },
  "serviceVariationId": {
    "type": "string",
    "description": "The service variation ID from availability check",
    "required": true
  },
  "teamMemberId": {
    "type": "string",
    "description": "Specific barber/team member ID if customer has preference (optional)",
    "required": false
  }
}
```

---

### Tool 3: Reschedule Booking

**Configuration:**
- **Name:** `rescheduleBooking`
- **Description:** `Change the time of an existing appointment. First lookup the booking to get the booking ID, then use this tool with the new time.`
- **URL:** `https://square-mcp-server-265357944939.us-east4.run.app/tools/rescheduleBooking`
- **Method:** `POST`
- **Authentication:** None

**Body Parameters:**
```json
{
  "bookingId": {
    "type": "string",
    "description": "The booking ID from the lookup results",
    "required": true
  },
  "newStartTime": {
    "type": "string",
    "description": "New appointment time in ISO 8601 format (e.g., 2025-10-15T14:00:00Z)",
    "required": true
  }
}
```

---

### Tool 4: Cancel Booking

**Configuration:**
- **Name:** `cancelBooking`
- **Description:** `Cancel an existing appointment. First lookup the booking to get the booking ID, then use this tool. Ask customer to confirm cancellation before proceeding.`
- **URL:** `https://square-mcp-server-265357944939.us-east4.run.app/tools/cancelBooking`
- **Method:** `POST`
- **Authentication:** None

**Body Parameters:**
```json
{
  "bookingId": {
    "type": "string",
    "description": "The booking ID to cancel",
    "required": true
  }
}
```

---

### Tool 5: Lookup Booking

**Configuration:**
- **Name:** `lookupBooking`
- **Description:** `Find existing appointments by customer's phone number. Use this when customer wants to reschedule, cancel, or check their appointment.`
- **URL:** `https://square-mcp-server-265357944939.us-east4.run.app/tools/lookupBooking`
- **Method:** `POST`
- **Authentication:** None

**Body Parameters:**
```json
{
  "customerPhone": {
    "type": "string",
    "description": "Customer's phone number to search for bookings",
    "required": true
  },
  "customerName": {
    "type": "string",
    "description": "Customer's name for additional verification (optional)",
    "required": false
  }
}
```

---

## 🎯 Step 3: Update Agent System Prompt

Add this to your agent's system prompt to guide tool usage:

```
You are the AI receptionist for K Barbershop. You can help customers book, reschedule, and cancel appointments.

TOOL USAGE WORKFLOW:

For NEW bookings:
1. Greet the customer warmly
2. Use checkAvailability to show available time slots
3. Collect: customer name, phone number, email (optional), preferred time
4. Confirm all details with customer
5. Use createBooking to book the appointment
6. Provide confirmation with appointment details

For RESCHEDULING:
1. Get customer's phone number
2. Use lookupBooking to find their appointment
3. Show current appointment details
4. Use checkAvailability to show new available times
5. Get customer's preferred new time
6. Confirm change with customer
7. Use rescheduleBooking with the booking ID

For CANCELLATIONS:
1. Get customer's phone number
2. Use lookupBooking to find their appointment
3. Show appointment details
4. Ask customer to confirm they want to cancel
5. Use cancelBooking with the booking ID
6. Confirm cancellation

IMPORTANT RULES:
- Always confirm details before creating/changing appointments
- Be friendly and professional
- If lookup returns multiple bookings, ask which one they're calling about
- Always read back appointment details for confirmation
- Convert times to customer's local timezone (EST for K Barbershop)
```

---

## ✅ Step 4: Test Your Integration

### Test in ElevenLabs Dashboard:

1. **Test Availability:**
   - Ask: "What time slots do you have available this week?"
   - Agent should call `checkAvailability` and show results

2. **Test Booking:**
   - Say: "I'd like to book a haircut for tomorrow at 2pm. My name is John Smith and my phone is 555-0123"
   - Agent should use `createBooking`

3. **Test Lookup:**
   - Say: "I need to check my appointment. My phone is 555-0123"
   - Agent should use `lookupBooking`

4. **Test Reschedule:**
   - Say: "Can I move my appointment to a different day?"
   - Agent should lookup → show availability → reschedule

5. **Test Cancel:**
   - Say: "I need to cancel my appointment"
   - Agent should lookup → confirm → cancel

---

## 📊 Monitoring & Analytics

### Check Server Health:
```bash
curl https://square-mcp-server-265357944939.us-east4.run.app/health
```

### View Booking Sources (Last 30 Days):
```bash
curl https://square-mcp-server-265357944939.us-east4.run.app/analytics/sources
```

This shows how many bookings came from:
- Phone (ElevenLabs AI)
- Website
- In-store
- Manual

---

## 🔍 Troubleshooting

### Tool Not Being Called:
- Check tool name and description are clear
- Update system prompt with more specific instructions
- Test with simpler queries first

### Authentication Errors:
- Verify Cloud Run deployment succeeded
- Check environment variables are set correctly
- Test endpoint directly with curl

### Booking Fails:
- Check Square API credentials are valid
- Verify Location ID matches your Square location
- Look at Cloud Run logs: `gcloud run logs read square-mcp-server --region us-east4`

---

## 📝 Next Steps

1. Deploy updated server to Cloud Run
2. Configure all 5 tools in ElevenLabs
3. Update agent system prompt
4. Test each workflow thoroughly
5. Monitor analytics endpoint to track phone vs website bookings

**All phone bookings will be tagged as "Phone Booking (ElevenLabs AI)" in Square's customer notes for tracking!**
