# K Barbershop - Backend Services

**Complete backend infrastructure for K Barbershop: ElevenLabs AI receptionist + Python website backend**

---

## 🎯 Overview

This repository contains TWO backend services for K Barbershop:

### 1. **ElevenLabs AI Receptionist (Node.js)** 
Phone receptionist connected to Square Appointments API
- ✅ Check available appointment times
- ✅ Book new appointments  
- ✅ Reschedule existing appointments
- ✅ Cancel appointments
- ✅ Look up bookings by phone
- 📞 **Deployed:** https://square-mcp-server-265357944939.us-east4.run.app

### 2. **Website Backend API (Python)** 
FastAPI backend for the K Barbershop website
- ✅ Customer management
- ✅ Booking creation and validation
- ✅ Barber profiles with images
- ✅ Service catalog
- ✅ Square API integration
- 🌐 **Deployed:** https://k-barbershop-backend-265357944939.us-east4.run.app

---

## 📂 Repository Structure

```
ai_receptionist/
├── 📞 ElevenLabs AI Receptionist (Node.js)
│   ├── server.js              # Main server with booking tools
│   ├── package.json           # Node.js dependencies
│   ├── Dockerfile            # Container configuration
│   └── deploy.sh             # Deployment script
│
├── 🐍 Python Website Backend
│   └── backend/
│       ├── square_service.py     # Square API integration (FIXED ✅)
│       ├── server.py             # FastAPI application
│       ├── models.py             # Pydantic data models
│       ├── database.py           # Firestore operations
│       ├── requirements.txt      # Python dependencies
│       ├── Dockerfile           # Container configuration
│       ├── cloudbuild.yaml      # Cloud Build config
│       ├── deploy_fix.sh        # Deployment script
│       ├── test_fix.sh          # Testing script
│       └── README.md            # Python backend docs
│
└── 📚 Documentation
    ├── ELEVENLABS_SETUP.md              # ElevenLabs configuration
    ├── CRITICAL_FIX_SQUARE_CUSTOMER_API.md  # Recent fix details
    └── [Other docs...]
```

---

## 🚀 Quick Start

### Deploy ElevenLabs AI (Node.js)
```bash
chmod +x deploy.sh
./deploy.sh
```

### Deploy Website Backend (Python)
```bash
cd backend
chmod +x deploy_fix.sh
./deploy_fix.sh
```

---

## 🔧 Recent Updates

### ✅ Oct 8, 2025: Square Customer API Fix
**Issue:** Python backend was failing to create new customers
**Fix:** Removed incorrect wrapper in `square_service.py`
**Status:** Fixed and deployed ✅

See [`CRITICAL_FIX_SQUARE_CUSTOMER_API.md`](CRITICAL_FIX_SQUARE_CUSTOMER_API.md) for details.

---

## 📊 API Endpoints

### ElevenLabs AI (Node.js) - Port 8080

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/tools/getAvailability` | POST | Check available time slots |
| `/tools/createBooking` | POST | Create appointment |
| `/tools/rescheduleBooking` | POST | Reschedule appointment |
| `/tools/cancelBooking` | POST | Cancel appointment |
| `/tools/lookupBooking` | POST | Find bookings by phone |
| `/health` | GET | Server health check |
| `/analytics/sources` | GET | Booking sources stats |

### Website Backend (Python) - Port 8080

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/` | GET | API health check |
| `/api/services` | GET | Get all services |
| `/api/barbers` | GET | Get barber profiles |
| `/api/barbers/{id}/availability` | GET | Get barber availability |
| `/api/bookings` | POST | Create booking |
| `/api/bookings/{id}` | GET | Get booking details |

---

## 🔐 Environment Variables

### ElevenLabs AI (Node.js)
```bash
SQUARE_ACCESS_TOKEN=your_token_here
SQUARE_LOCATION_ID=LCS4MXPZP8J3M
PORT=8080
```

### Website Backend (Python)
```bash
SQUARE_ACCESS_TOKEN=your_token_here
SQUARE_LOCATION_ID=LCS4MXPZP8J3M
GOOGLE_CLOUD_PROJECT=website-473417
ENVIRONMENT=production
PORT=8080
```

---

## 🧪 Testing

### Test ElevenLabs AI
```bash
curl https://square-mcp-server-265357944939.us-east4.run.app/health
```

### Test Website Backend
```bash
cd backend
chmod +x test_fix.sh
./test_fix.sh
```

---

## 🔍 Monitoring

### View Logs (ElevenLabs)
```bash
gcloud run logs read square-mcp-server --region us-east4 --limit 50
```

### View Logs (Website Backend)
```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=k-barbershop-backend" \
  --limit 50 \
  --project website-473417
```

### Check for Errors
```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND severity>=ERROR" \
  --limit 10 \
  --project website-473417
```

---

## 🏗️ Architecture

```
┌─────────────────────┐
│   ElevenLabs AI     │
│   (Phone Calls)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Node.js Server     │◄──── /tools/getAvailability
│  (AI Receptionist)  │◄──── /tools/createBooking
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Square API        │
│   (Appointments)    │
└─────────────────────┘
           ▲
           │
┌──────────┴──────────┐
│  Python Backend     │◄──── Website
│  (FastAPI)          │◄──── Mobile App
└─────────────────────┘
           │
           ▼
┌─────────────────────┐
│  Google Firestore   │
│  (Database)         │
└─────────────────────┘
```

---

## 📚 Documentation

- **ElevenLabs Setup:** [`ELEVENLABS_SETUP.md`](ELEVENLABS_SETUP.md)
- **Python Backend:** [`backend/README.md`](backend/README.md)
- **Recent Fix:** [`CRITICAL_FIX_SQUARE_CUSTOMER_API.md`](CRITICAL_FIX_SQUARE_CUSTOMER_API.md)
- **Service IDs:** [`SERVICE_VARIATION_IDS.md`](SERVICE_VARIATION_IDS.md)

---

## 🐛 Troubleshooting

### ElevenLabs AI Not Working
1. Check tool URLs in ElevenLabs dashboard
2. Verify Square credentials are correct
3. Test endpoints directly with curl
4. Check Cloud Run logs

### Website Backend Errors
1. Check `backend/square_service.py` has the fix
2. Verify environment variables in Cloud Run
3. Check Firestore connection
4. Review recent error logs

### Customer Creation Fails
If you see "unrecognized field 'customer'" errors:
1. Ensure latest code is deployed
2. Verify fix in `backend/square_service.py` line ~510
3. Redeploy using `./deploy_fix.sh`

---

## 🔗 Links

- **Live Services:**
  - ElevenLabs AI: https://square-mcp-server-265357944939.us-east4.run.app
  - Website Backend: https://k-barbershop-backend-265357944939.us-east4.run.app
- **Square Developer:** https://developer.squareup.com
- **ElevenLabs Docs:** https://elevenlabs.io/docs/conversational-ai
- **FastAPI Docs:** https://fastapi.tiangolo.com

---

## 📞 Support

For issues:
1. Check the relevant README in each service directory
2. Review recent fix documentation
3. Check Cloud Run logs
4. Open an issue on GitHub

---

## 📄 License

MIT License - K Barbershop 2025

---

**Last Updated:** October 8, 2025  
**Version:** 3.0.0 (Multi-service repository with Python backend)
