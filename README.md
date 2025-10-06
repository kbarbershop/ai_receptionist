# K Barbershop AI Receptionist - Square Integration

**ElevenLabs AI phone receptionist connected to Square Appointments API**

---

## 🎯 What This Does

This server connects your ElevenLabs AI receptionist to Square, allowing customers to:
- ✅ Check available appointment times
- ✅ Book new appointments  
- ✅ Reschedule existing appointments
- ✅ Cancel appointments
- ✅ Look up their bookings

**All phone bookings are automatically tagged in Square as "Phone Booking (ElevenLabs AI)" for analytics!**

---

## 📂 Project Structure

```
ai_receptionist/
├── server.js              # Main server with 5 booking functions
├── package.json           # Node.js dependencies
├── Dockerfile            # Container configuration
├── .dockerignore         # Build optimization
├── deploy.sh             # One-command deployment script
├── ELEVENLABS_SETUP.md   # Step-by-step ElevenLabs configuration
└── README.md             # This file
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker Desktop
- Google Cloud SDK (gcloud CLI)
- ElevenLabs account with Conversational AI agent

### 1. Clone & Deploy

```bash
# Clone the repo
git clone https://github.com/kbarbershop/ai_receptionist.git
cd ai_receptionist

# Make deploy script executable
chmod +x deploy.sh

# Deploy to Google Cloud Run
./deploy.sh
```

### 2. Configure ElevenLabs

Follow the complete guide in **[ELEVENLABS_SETUP.md](ELEVENLABS_SETUP.md)** to:
1. Add 5 webhook tools to your ElevenLabs agent
2. Update your agent's system prompt
3. Test each booking workflow

---

## 🔧 API Endpoints

### Server Tools (for ElevenLabs)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/tools/getAvailability` | POST | Check available time slots (7-day window) |
| `/tools/createBooking` | POST | Create new appointment |
| `/tools/rescheduleBooking` | POST | Change appointment time |
| `/tools/cancelBooking` | POST | Cancel appointment |
| `/tools/lookupBooking` | POST | Find bookings by phone number |

### Health & Analytics

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Server health check |
| `/analytics/sources` | GET | Booking sources (last 30 days) |

---

## 📊 Booking Analytics

Track where your appointments come from:

```bash
curl https://square-mcp-server-265357944939.us-east4.run.app/analytics/sources
```

Response shows counts for:
- **Phone bookings** (ElevenLabs AI)
- **Website bookings** (from your site)
- **In-store bookings**
- **Manual bookings**

---

## 🔐 Environment Variables

Set in Google Cloud Run:

```bash
SQUARE_ACCESS_TOKEN=EAAAl6DLAw75VQSm6qSi4cwNA_Y10kPC4ZtycW-GikXXgDbapqr9aipErTiaXqMr
SQUARE_LOCATION_ID=LCS4MXPZP8J3M
```

---

## 🧪 Testing

### Test Server Health
```bash
curl https://square-mcp-server-265357944939.us-east4.run.app/health
```

### Test Tool Endpoints

**Get Availability:**
```bash
curl -X POST https://square-mcp-server-265357944939.us-east4.run.app/tools/getAvailability \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-10-15"
  }'
```

**Create Booking:**
```bash
curl -X POST https://square-mcp-server-265357944939.us-east4.run.app/tools/createBooking \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "John Smith",
    "customerPhone": "5551234567",
    "customerEmail": "john@example.com",
    "startTime": "2025-10-15T14:00:00Z",
    "serviceVariationId": "YOUR_SERVICE_ID"
  }'
```

**Lookup Booking:**
```bash
curl -X POST https://square-mcp-server-265357944939.us-east4.run.app/tools/lookupBooking \
  -H "Content-Type: application/json" \
  -d '{
    "customerPhone": "5551234567"
  }'
```

---

## 📝 Development

### Local Development

```bash
# Install dependencies
npm install

# Set environment variables
export SQUARE_ACCESS_TOKEN=your_token_here
export SQUARE_LOCATION_ID=your_location_id_here

# Run locally
npm start
```

Server runs on `http://localhost:8080`

### Make Changes & Redeploy

```bash
# Edit server.js with your changes
vim server.js

# Commit to GitHub
git add .
git commit -m "Your change description"
git push origin main

# Redeploy to Cloud Run
./deploy.sh
```

---

## 🔍 Monitoring & Logs

### View Cloud Run Logs
```bash
gcloud run logs read square-mcp-server --region us-east4 --limit 50
```

### Monitor in Real-Time
```bash
gcloud run logs tail square-mcp-server --region us-east4
```

### Check Service Status
```bash
gcloud run services describe square-mcp-server --region us-east4
```

---

## 🐛 Troubleshooting

### Server Returns 500 Error
- Check Cloud Run logs: `gcloud run logs read square-mcp-server --region us-east4`
- Verify Square credentials are correct
- Ensure Location ID matches your Square location

### ElevenLabs Can't Call Tools
- Verify tool URLs match your Cloud Run service URL
- Check tool configurations in ElevenLabs dashboard
- Test endpoints directly with curl first

### Bookings Not Appearing in Square
- Confirm `serviceVariationId` is valid (from Square Catalog)
- Check Square Dashboard → Appointments
- Verify booking time is in valid format (ISO 8601)

### Time Zone Issues
- All times are in UTC (ISO 8601 format)
- K Barbershop is in EST (UTC-5)
- Convert customer times to UTC before booking

---

## 🔗 Links

- **GitHub Repo:** https://github.com/kbarbershop/ai_receptionist
- **Live Server:** https://square-mcp-server-265357944939.us-east4.run.app
- **ElevenLabs Setup:** [ELEVENLABS_SETUP.md](ELEVENLABS_SETUP.md)
- **Square Developer:** https://developer.squareup.com
- **ElevenLabs Docs:** https://elevenlabs.io/docs/conversational-ai

---

## 📞 Support

For issues with:
- **This server:** Open an issue on GitHub
- **ElevenLabs:** Contact ElevenLabs support
- **Square API:** Check Square Developer docs

---

## 📄 License

MIT License - K Barbershop 2025

---

**Last Updated:** October 6, 2025  
**Version:** 2.0.0 (ElevenLabs Server Tools Format)
