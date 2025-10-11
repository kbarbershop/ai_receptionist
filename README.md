# AI Receptionist - K Barbershop Booking System

**Version 2.8.10** - Modular Architecture

An ElevenLabs conversational AI agent backend that handles phone bookings for K Barbershop by interfacing with Square's booking system.

## 🏛️ Architecture

```
src/
├── config/
│   ├── constants.js          # Booking sources, service mappings, location ID
│   └── square.js              # Square client initialization
├── utils/
│   ├── phoneNumber.js         # Phone normalization utilities
│   ├── datetime.js            # Date/time formatting utilities
│   └── bigint.js              # BigInt sanitization utilities
├── services/
│   ├── customerService.js     # Customer find/create logic
│   ├── bookingService.js      # Booking CRUD operations
│   └── availabilityService.js # Availability checking logic
├── routes/
│   ├── toolsRoutes.js         # ElevenLabs tool endpoints
│   └── analyticsRoutes.js     # Health & analytics endpoints
└── app.js                     # Main Express app
```

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- Square API credentials (Production environment)
- Google Cloud Run (for deployment)

### Installation

```bash
# Install dependencies
npm install

# Set environment variables
export SQUARE_ACCESS_TOKEN=your_production_token
export SQUARE_LOCATION_ID=LCS4MXPZP8J3M
export PORT=8080

# Run locally
npm start

# Run with auto-reload (development)
npm run dev
```

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|--------|
| `SQUARE_ACCESS_TOKEN` | Production Square API token | Yes | - |
| `SQUARE_LOCATION_ID` | Square location ID | No | LCS4MXPZP8J3M |
| `PORT` | Server port | No | 8080 |

## 📡 API Endpoints

### ElevenLabs Server Tools

All tool endpoints accept JSON and return JSON responses.

#### 1. Get Current Date/Time
```http
POST /tools/getCurrentDateTime
```
Provides context to AI agent about current date, tomorrow, and next Thursday.

#### 2. Get Availability
```http
POST /tools/getAvailability
Content-Type: application/json

{
  "startDate": "2025-10-15",  // YYYY-MM-DD or ISO 8601
  "serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF",
  "teamMemberId": "TMKzhB-WjsDff5rr"  // optional
}
```

#### 3. Create Booking
```http
POST /tools/createBooking
Content-Type: application/json

{
  "customerName": "John Doe",
  "customerPhone": "5715276016",
  "customerEmail": "john@example.com",  // optional
  "startTime": "2025-10-15T14:00:00-04:00",
  "serviceVariationId": "7XPUHGDLY4N3H2OWTHMIABKF",
  "teamMemberId": "TMKzhB-WjsDff5rr"  // optional
}
```

#### 4. Add Services to Booking
```http
POST /tools/addServicesToBooking
Content-Type: application/json

{
  "bookingId": "abc123",
  "serviceNames": ["Beard Trim", "Nose Waxing"]
}
```

#### 5. Reschedule Booking
```http
POST /tools/rescheduleBooking
Content-Type: application/json

{
  "bookingId": "abc123",
  "newStartTime": "2025-10-16T15:00:00-04:00"
}
```

#### 6. Cancel Booking
```http
POST /tools/cancelBooking
Content-Type: application/json

{
  "bookingId": "abc123"
}
```

#### 7. Lookup Booking
```http
POST /tools/lookupBooking
Content-Type: application/json

{
  "customerPhone": "5715276016"
}
```

#### 8. General Inquiry
```http
POST /tools/generalInquiry
Content-Type: application/json

{
  "inquiryType": "hours"  // hours, services, staff, or omit for all
}
```

### Analytics Endpoints

#### Health Check
```http
GET /health
```

#### Booking Sources Analytics
```http
GET /analytics/sources
```
Returns booking count by source (phone, website, in-store) for last 30 days.

## 🔧 Key Features

### Phone Number Handling
- **Search**: Uses E.164 format with + prefix (`+15715276016`)
- **Create**: Uses 10 digits without +1 (`5715276016`)
- **Normalization**: Automatic conversion from various input formats

### Timezone Management
- **Barbershop Timezone**: America/New_York (EDT)
- **Auto-correction**: Validates and fixes missing timezone offsets
- **UTC Conversion**: All Square API calls use UTC internally
- **Human-readable**: Formats dates as "Thu, Oct 10, 2025 2:00 PM EDT"

### Availability Logic
- Filters out cancelled bookings
- Prevents overlapping appointments
- Allows back-to-back bookings
- 1-minute tolerance for time matching
- Validates past dates automatically

### Error Handling
- Enhanced logging for Square API errors
- Detailed error messages for debugging
- Graceful fallbacks for missing data
- Comprehensive input validation

## 📦 Deployment

### Google Cloud Run

1. **Build container:**
```bash
gcloud builds submit --tag gcr.io/[PROJECT-ID]/ai-receptionist
```

2. **Deploy to Cloud Run:**
```bash
gcloud run deploy ai-receptionist \
  --image gcr.io/[PROJECT-ID]/ai-receptionist \
  --platform managed \
  --region us-east1 \
  --set-env-vars SQUARE_ACCESS_TOKEN=$SQUARE_ACCESS_TOKEN,SQUARE_LOCATION_ID=LCS4MXPZP8J3M
```

3. **Update ElevenLabs agent** with new Cloud Run URL

## 📊 Available Services

| Service | Variation ID | Duration |
|---------|--------------|----------|
| Regular Haircut | 7XPUHGDLY4N3H2OWTHMIABKF | 30 min |
| Beard Trim | SPUX6LRBS6RHFBX3MSRASG2J | 30 min |
| Beard Sculpt | UH5JRVCJGAB2KISNBQ7KMVVQ | 30 min |
| Ear Waxing | ALZZEN4DO6JCNMC6YPXN6DPH | 10 min |
| Nose Waxing | VVGK7I7L6BHTG7LFKLAIRHBZ | 10 min |
| Eyebrow Waxing | 3TV5CVRXCB62BWIWVY6OCXIC | 10 min |
| Paraffin | 7ND6OIFTRLJEPMDBBI3B3ELT | 30 min |
| Gold | 7UKWUIF4CP7YR27FI52DWPEN | 90 min |
| Silver | 7PFUQVFMALHIPDAJSYCBKBYV | 60 min |

## 🐛 Debugging

All console logs use emoji prefixes for easy scanning:
- ✅ Success operations
- ❌ Errors and failures
- 🔍 Search/query operations
- 📅 Booking operations
- 🔧 API calls
- 🕐 Time operations
- 📞 Phone operations

## 📝 Version History

### v2.8.10 (Current)
- 🏛️ Restructured into modular architecture
- 🔧 Fixed phone number format for createCustomer (10 digits, no +1)
- 📦 Separated concerns: config, utils, services, routes
- 📋 Improved maintainability and testability

### v2.8.8
- 🔍 Enhanced error logging for debugging
- ✅ Captured full Square API error details

### v2.7.x
- Timezone validation and auto-correction
- Separated active/cancelled bookings
- Fixed overlap detection
- Added time matching with tolerance

## 📚 Resources

- [Square Bookings API Docs](https://developer.squareup.com/docs/bookings-api/overview)
- [ElevenLabs Conversational AI](https://elevenlabs.io/docs/conversational-ai)
- [Google Cloud Run Docs](https://cloud.google.com/run/docs)

## 🔐 Security Notes

- Never commit `.env` or expose `SQUARE_ACCESS_TOKEN`
- Use production tokens only in production environment
- Rotate API keys regularly
- Monitor Cloud Run logs for suspicious activity

## ⚙️ Future Improvements

- [ ] Add Redis caching for Square API responses
- [ ] Implement retry logic with exponential backoff
- [ ] Add comprehensive unit tests
- [ ] Set up CI/CD pipeline
- [ ] Add monitoring/alerting (Datadog, Sentry)
- [ ] Implement rate limiting middleware
- [ ] Create OpenAPI/Swagger documentation

## 👥 Support

For issues or questions, contact: admin@k-barbershop.com

---

**K Barbershop** | Built with ❤️ using Square API & ElevenLabs
