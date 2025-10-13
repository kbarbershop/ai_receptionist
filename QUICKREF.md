# Quick Reference Card

## 🚀 Deploy Commands
```bash
cd ~/square-mcp-server-deploy
git pull origin main
chmod +x deploy.sh test.sh
./deploy.sh
./test.sh
```

## 🔗 URLs
- **Server:** https://square-mcp-server-265357944939.us-east4.run.app
- **GitHub:** https://github.com/kbarbershop/ai_receptionist
- **Health:** https://square-mcp-server-265357944939.us-east4.run.app/health
- **Analytics:** https://square-mcp-server-265357944939.us-east4.run.app/analytics/sources

## 🔧 API Endpoints for ElevenLabs
```
POST /tools/getAvailability
POST /tools/createBooking
POST /tools/rescheduleBooking
POST /tools/cancelBooking
POST /tools/lookupBooking
```

## 🔐 Credentials
- **Square Token:** EAAAl6DLAw75VQSm6qSi4cwNA_Y10kPC4ZtycW-GikXXgDbapqr9aipErTiaXqMr
- **Location ID:** LCS4MXPZP8J3M
- **Project:** website-473417
- **Region:** us-east4

## 📊 Monitoring
```bash
# View logs
gcloud run logs read square-mcp-server --region us-east4 --limit 50

# Monitor live
gcloud run logs tail square-mcp-server --region us-east4

# Check service
gcloud run services describe square-mcp-server --region us-east4

# Test endpoints
curl https://square-mcp-server-265357944939.us-east4.run.app/health

# Google Cloud MCP Reauth
gcloud auth application-default login
```

## 📚 Documentation Files
- **README.md** - Complete project overview
- **ELEVENLABS_SETUP.md** - Step-by-step ElevenLabs configuration
- **SUMMARY.md** - Issue resolution details
- **QUICKREF.md** - This file

## 🎯 ElevenLabs Setup Checklist
- [ ] Redeploy server: `./deploy.sh`
- [ ] Test health: `./test.sh`
- [ ] Add 5 webhook tools in ElevenLabs
- [ ] Update agent system prompt
- [ ] Test: availability → booking → lookup → reschedule → cancel
- [ ] Verify bookings show in Square with "Phone Booking" tag

## 🆘 Common Commands

**Rebuild & Deploy:**
```bash
./deploy.sh
```

**Test All Endpoints:**
```bash
./test.sh
```

**Check Health:**
```bash
curl https://square-mcp-server-265357944939.us-east4.run.app/health | jq
```

**View Recent Logs:**
```bash
gcloud run logs read square-mcp-server --region us-east4 --limit 20
```

**Test Availability:**
```bash
curl -X POST https://square-mcp-server-265357944939.us-east4.run.app/tools/getAvailability \
  -H "Content-Type: application/json" \
  -d '{"startDate": "'$(date +%Y-%m-%d)'"}' | jq
```

## 🐛 Quick Troubleshooting

**Server not responding?**
```bash
gcloud run services describe square-mcp-server --region us-east4
```

**ElevenLabs can't call tools?**
- Check tool URLs match your server
- Test with curl first
- Verify authentication is set to "None"

**Bookings failing?**
- Check logs: `gcloud run logs read square-mcp-server --region us-east4`
- Verify Square credentials
- Ensure time format is ISO 8601 (UTC)

**Need help?**
See SUMMARY.md for complete troubleshooting guide

---

**Last Updated:** October 6, 2025
