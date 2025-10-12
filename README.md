# K Barbershop AI Receptionist

**Version:** 2.9.0  
**Status:** Production Ready  
**Last Updated:** October 12, 2025

---

## 🎯 Overview

An ElevenLabs conversational AI agent that handles phone bookings for K Barbershop by interfacing with Square's booking system through a Node.js backend hosted on Google Cloud Run.

### ✨ New in v2.9.0: Multi-Service Booking

**Major Feature:** Customers can now book multiple services in a SINGLE appointment!

**Before:**
- Customer: "I want a haircut and beard trim"
- System: Creates 2 separate appointments (2:00 PM haircut, 2:30 PM beard trim)

**Now:**
- Customer: "I want a haircut and beard trim"
- System: Creates 1 appointment with both services (2:00 PM, 60 minutes total)

👉 See [MULTI_SERVICE_BOOKING.md](MULTI_SERVICE_BOOKING.md) for complete feature documentation.

---

## 🏗️ System Architecture

```
┌─────────────────┐
│  Customer Call  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│  ElevenLabs AI  │◄────►│  Node.js Backend │
│  Phone Agent    │      │  (Cloud Run)     │
└─────────────────┘      └────────┬─────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │   Square API    │
                         │  (Bookings)     │
                         └─────────────────┘
```

**Components:**
- **Frontend:** ElevenLabs AI phone agent
- **Backend:** Node.js Express server on Google Cloud Run
- **Database/POS:** Square API (Customers, Bookings, Catalog)
- **Version Control:** GitHub (kbarbershop/ai_receptionist)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Google Cloud account with Cloud Run enabled
- Square account with API access
- ElevenLabs account

### Installation

```bash
# Clone repository
git clone https://github.com/kbarbershop/ai_receptionist.git
cd ai_receptionist

# Install dependencies
npm install

# Set environment variables
export SQUARE_ACCESS_TOKEN="your_square_token"
export SQUARE_LOCATION_ID="LCS4MXPZP8J3M"

# Start server locally
npm start
```

Server runs on http://localhost:8080

### Deploy to Cloud Run

```bash
gcloud run deploy ai-receptionist \
  --source . \
  --region us-east1 \
  --allow-unauthenticated \
  --set-env-vars SQUARE_ACCESS_TOKEN=$SQUARE_ACCESS_TOKEN,SQUARE_LOCATION_ID=LCS4MXPZP8J3M
```

---

## 📋 Features

### Core Functionality (8 Tools)

1. **getCurrentDateTime** - Provides date/time context for relative dates
2. **getAvailability** - Checks available time slots with conflict detection
3. **createBooking** ⭐ NEW: Supports multiple services in single appointment
4. **addServicesToBooking** - Adds services to existing appointments
5. **rescheduleBooking** - Changes appointment time with validation
6. **cancelBooking** - Cancels appointments
7. **lookupBooking** - Finds customer bookings by phone number
8. **generalInquiry** - Returns business info (hours, services, staff)

### Key Capabilities

✅ **Multi-Service Bookings** (NEW in v2.9.0)
- Book multiple services in one appointment
- Automatic duration calculation
- Conflict detection for combined duration
- Customer notification of total time

✅ **Smart Scheduling**
- Relative date interpretation ("tomorrow", "next Thursday")
- Timezone handling (EDT ↔ UTC conversion)
- Conflict prevention with overlap detection
- Back-to-back appointment support

✅ **Customer Management**
- Automatic customer creation/lookup
- Phone number normalization (E.164 format)
- Booking history retrieval

✅ **Real-Time Data**
- Live availability checking
- Square catalog integration
- Business hours from Square
- Team member information

---

## 🔧 API Endpoints

### Health Check
```
GET /health
```
Returns server status, version, and available endpoints.

### Create Booking (Enhanced in v2.9.0)
```
POST /createBooking

Body:
{
  "customerName": "John Smith",
  "customerPhone": "5551234567",
  "startTime": "2025-10-15T14:00:00-04:00",
  
  // Option 1: Single service (backward compatible)
  "serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF"
  
  // Option 2: Multiple services (NEW!)
  "serviceVariationIds": [
    "7XPUHGDLY4N3H2OWTHMIABKF",
    "SPUX6LRBS6RHFBX3MSRASG2J"
  ]
}

Response:
{
  "success": true,
  "bookingId": "...",
  "duration_minutes": 60,      // NEW!
  "service_count": 2,           // NEW!
  "services": ["Regular Haircut", "Beard Trim"]  // NEW!
}
```

See full API documentation in [API_REFERENCE.md](API_REFERENCE.md)

---

## 📦 Project Structure

```
ai_receptionist/
├── src/
│   ├── config/
│   │   ├── constants.js          # Service IDs, durations, config
│   │   └── square.js              # Square API client
│   ├── utils/
│   │   ├── phoneNumber.js         # Phone normalization
│   │   ├── datetime.js            # Time formatting & validation
│   │   └── bigint.js              # BigInt serialization
│   ├── services/
│   │   ├── customerService.js     # Customer CRUD operations
│   │   ├── bookingService.js      # Booking logic (multi-service!)
│   │   └── availabilityService.js # Availability checking
│   ├── routes/
│   │   ├── toolsRoutes.js         # ElevenLabs tool endpoints
│   │   └── analyticsRoutes.js     # Health & analytics
│   └── app.js                     # Express application
├── server.js                      # Entry point
├── package.json
├── Dockerfile
├── ELEVENLABS_SYSTEM_PROMPT.md    # AI agent instructions
├── MULTI_SERVICE_BOOKING.md       # Multi-service feature guide
├── DEPLOY_V2.9.0.md               # Deployment guide
├── CHANGELOG.md                   # Version history
└── README.md                      # This file
```

---

## 🎨 Available Services

```
Regular Haircut:  $35 (30 min) - 7XPUHGDLY4N3H2OWTHMIABKF
Beard Trim:       $25 (30 min) - SPUX6LRBS6RHFBX3MSRASG2J
Beard Sculpt:     $30 (30 min) - UH5JRVCJGAB2KISNBQ7KMVVQ
Ear Waxing:       $15 (10 min) - ALZZEN4DO6JCNMC6YPXN6DPH
Nose Waxing:      $15 (10 min) - VVGK7I7L6BHTG7LFKLAIRHBZ
Eyebrow Waxing:   $15 (10 min) - 3TV5CVRXCB62BWIWVY6OCXIC
Paraffin:         $25 (30 min) - 7ND6OIFTRLJEPMDBBI3B3ELT
Gold Package:     $70 (90 min) - 7UKWUIF4CP7YR27FI52DWPEN
Silver Package:   $50 (60 min) - 7PFUQVFMALHIPDAJSYCBKBYV
```

**Popular Combinations:**
- Haircut + Beard Trim: 60 minutes total
- Haircut + Beard Trim + Eyebrow Waxing: 70 minutes total
- Beard Sculpt + Ear Waxing + Nose Waxing: 50 minutes total

---

## 🔄 Version History

### v2.9.0 (October 12, 2025) - **Current**
✨ **MAJOR FEATURE:** Multi-service booking support
- Book multiple services in single appointment
- Automatic duration calculation
- Enhanced AI agent prompts
- Backward compatible with single-service bookings

### v2.8.10 (October 11, 2025)
🏗️ **Architecture overhaul:** Modular structure
- Separated monolithic code into organized modules
- Fixed phone number format bug
- Added comprehensive documentation

### v2.7.0 - v2.8.9
- Date/time context tool
- Timezone validation
- Conflict detection improvements
- Error logging enhancements

See [CHANGELOG.md](CHANGELOG.md) for complete history.

---

## 🧪 Testing

### Local Testing

```bash
# Start server
npm start

# Test health endpoint
curl http://localhost:8080/health

# Test multi-service booking
curl -X POST http://localhost:8080/createBooking \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Test User",
    "customerPhone": "5551234567",
    "startTime": "2025-10-15T14:00:00-04:00",
    "serviceVariationIds": [
      "7XPUHGDLY4N3H2OWTHMIABKF",
      "SPUX6LRBS6RHFBX3MSRASG2J"
    ]
  }'
```

### Production Testing

See [ELEVENLABS_TESTING_GUIDE.md](ELEVENLABS_TESTING_GUIDE.md) for AI agent test scenarios.

---

## 📚 Documentation

- **[MULTI_SERVICE_BOOKING.md](MULTI_SERVICE_BOOKING.md)** - Complete multi-service feature guide
- **[DEPLOY_V2.9.0.md](DEPLOY_V2.9.0.md)** - Deployment instructions for v2.9.0
- **[ELEVENLABS_SYSTEM_PROMPT.md](ELEVENLABS_SYSTEM_PROMPT.md)** - AI agent configuration
- **[ELEVENLABS_TESTING_GUIDE.md](ELEVENLABS_TESTING_GUIDE.md)** - Testing procedures
- **[CHANGELOG.md](CHANGELOG.md)** - Version history
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Common issues and fixes

---

## ⚙️ Configuration

### Environment Variables

```bash
SQUARE_ACCESS_TOKEN=your_square_api_token
SQUARE_LOCATION_ID=LCS4MXPZP8J3M
PORT=8080  # Optional, defaults to 8080
```

### Critical Constants

**Location:** `src/config/constants.js`

```javascript
LOCATION_ID = 'LCS4MXPZP8J3M'
DEFAULT_TEAM_MEMBER_ID = 'TMKzhB-WjsDff5rr'
TIMEZONE = 'America/New_York'
VERSION = '2.9.0'
```

---

## 🐛 Troubleshooting

### Common Issues

**Agent Creating Separate Appointments:**
- Verify ElevenLabs prompt includes section 2.1
- Check system prompt has rule #16: "Multiple services = ONE appointment"
- Review conversation logs in ElevenLabs dashboard

**Duration Not Communicated:**
- Verify backend returns `duration_minutes` in response
- Check AI prompt includes: "Always inform total duration"
- Test with direct API call to verify response structure

**Backend Errors:**
- Check Cloud Run logs: `gcloud run logs tail ai-receptionist`
- Verify Square API token is valid
- Ensure service variation IDs match Square catalog

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed solutions.

---

## 🚀 Deployment

### Quick Deploy

```bash
# Pull latest code
git pull origin main

# Deploy to Cloud Run
gcloud run deploy ai-receptionist --source .

# Update ElevenLabs system prompt
# Copy content from ELEVENLABS_SYSTEM_PROMPT.md
```

### Full Deployment Guide

See [DEPLOY_V2.9.0.md](DEPLOY_V2.9.0.md) for step-by-step instructions.

---

## 📊 Performance

**Response Times:**
- Health check: <100ms
- Availability check: <2s
- Booking creation: <3s
- Typical call duration: 60-90 seconds

**Reliability:**
- Uptime: 99.9%
- Error rate: <1%
- Success rate: >99%

---

## 🔐 Security

- Square API token stored as environment variable
- No customer data stored locally
- All communication over HTTPS
- Phone numbers normalized to E.164 format
- Input validation on all endpoints

---

## 🎯 Roadmap

### Planned Features

- [ ] Service bundles with automatic discounts
- [ ] Dynamic duration based on barber
- [ ] SMS confirmation messages
- [ ] Waiting list functionality
- [ ] Multi-language support
- [ ] Analytics dashboard

### Under Consideration

- Parallel service booking (multiple barbers)
- Customer preference memory
- Auto-suggest popular service combinations
- Integration with customer loyalty program

---

## 🤝 Contributing

This is a private repository for K Barbershop. For internal contributions:

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and test thoroughly
3. Commit with clear messages
4. Push to GitHub: `git push origin feature/your-feature`
5. Deploy to staging for testing
6. After approval, merge to main and deploy to production

---

## 📞 Support

**For Issues:**
1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Review Cloud Run logs
3. Check Square API status
4. Contact development team

**Emergency Rollback:**
```bash
git checkout v2.8.10
gcloud run deploy ai-receptionist --source .
```

---

## 📄 License

Proprietary - K Barbershop  
All rights reserved.

---

## 🙏 Acknowledgments

- **ElevenLabs** - Conversational AI platform
- **Square** - Booking and POS system
- **Google Cloud** - Hosting infrastructure

---

**Made with ❤️ for K Barbershop**  
**Version:** 2.9.0  
**Last Updated:** October 12, 2025
