import express from 'express';
import { squareClient } from '../config/square.js';
import { LOCATION_ID, BOOKING_SOURCES, SERVICE_MAPPINGS, VERSION } from '../config/constants.js';

const router = express.Router();

/**
 * Health Check
 */
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Square Booking Server for ElevenLabs',
    version: `${VERSION} - Modular architecture with v2.8.10 phone fix`,
    sdkVersion: '43.0.2',
    architecture: 'Modular (config, utils, services, routes)',
    endpoints: {
      serverTools: [
        'POST /tools/getCurrentDateTime',
        'POST /tools/getAvailability',
        'POST /tools/createBooking',
        'POST /tools/addServicesToBooking',
        'POST /tools/rescheduleBooking',
        'POST /tools/cancelBooking',
        'POST /tools/lookupBooking',
        'POST /tools/generalInquiry'
      ],
      analytics: [
        'GET /health',
        'GET /analytics/sources'
      ]
    },
    bookingSources: BOOKING_SOURCES,
    availableServices: Object.keys(SERVICE_MAPPINGS)
  });
});

/**
 * Booking Sources Analytics
 */
router.get('/analytics/sources', async (req, res) => {
  try {
    const now = new Date();
    const past30Days = new Date();
    past30Days.setDate(past30Days.getDate() - 30);

    const bookingsResponse = await squareClient.bookingsApi.listBookings(
      undefined, undefined, undefined, undefined,
      LOCATION_ID,
      past30Days.toISOString(),
      now.toISOString()
    );

    const bookings = bookingsResponse.result.bookings || [];
    const sourceCounts = {
      phone: 0,
      website: 0,
      inStore: 0,
      manual: 0,
      unknown: 0
    };

    bookings.forEach(booking => {
      const note = booking.customerNote || '';
      if (note.includes('Phone Booking')) sourceCounts.phone++;
      else if (note.includes('Website Booking')) sourceCounts.website++;
      else if (note.includes('In Store')) sourceCounts.inStore++;
      else if (note.includes('Manual')) sourceCounts.manual++;
      else sourceCounts.unknown++;
    });

    res.json({
      period: 'Last 30 days',
      totalBookings: bookings.length,
      sources: sourceCounts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
