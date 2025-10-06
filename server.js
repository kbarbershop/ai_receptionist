import express from 'express';
import { Client } from 'square/legacy';
import { randomUUID } from 'crypto';

const app = express();
app.use(express.json());

// Initialize Square client using legacy API (compatible with SDK v40+)
const squareClient = new Client({
  bearerAuthCredentials: {
    accessToken: process.env.SQUARE_ACCESS_TOKEN
  },
  environment: 'production'
});

const LOCATION_ID = process.env.SQUARE_LOCATION_ID || 'LCS4MXPZP8J3M';

// Booking source constants
const BOOKING_SOURCES = {
  PHONE: 'Phone Booking (ElevenLabs AI)',
  WEBSITE: 'Website Booking',
  IN_STORE: 'In Store Booking',
  MANUAL: 'Manual Booking'
};

// ===== ELEVENLABS SERVER TOOLS ENDPOINTS =====

/**
 * Get Available Time Slots
 */
app.post('/tools/getAvailability', async (req, res) => {
  try {
    const { startDate, serviceVariationId } = req.body;
    
    const startDateStr = startDate || new Date().toISOString().split('T')[0];
    const startAt = new Date(startDateStr + 'T00:00:00Z');
    const endAt = new Date(startAt);
    endAt.setDate(endAt.getDate() + 7);

    const response = await squareClient.bookingsApi.searchAvailability({
      query: {
        filter: {
          locationId: LOCATION_ID,
          startAtRange: {
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString()
          },
          ...(serviceVariationId && { serviceVariationId })
        }
      }
    });

    res.json({
      success: true,
      availableSlots: response.result.availabilities || [],
      locationId: LOCATION_ID,
      searchPeriod: {
        start: startAt.toISOString(),
        end: endAt.toISOString()
      }
    });
  } catch (error) {
    console.error('getAvailability error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Create New Booking
 */
app.post('/tools/createBooking', async (req, res) => {
  try {
    const { customerName, customerPhone, customerEmail, startTime, serviceVariationId, teamMemberId } = req.body;

    if (!customerName || !customerPhone || !startTime || !serviceVariationId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: customerName, customerPhone, startTime, serviceVariationId'
      });
    }

    // Find or create customer
    let customerId;
    let isNewCustomer = false;
    
    try {
      const searchResponse = await squareClient.customersApi.searchCustomers({
        query: {
          filter: {
            phoneNumber: {
              exact: customerPhone.replace(/\D/g, '')
            }
          }
        }
      });

      if (searchResponse.result.customers && searchResponse.result.customers.length > 0) {
        customerId = searchResponse.result.customers[0].id;
      } else {
        const nameParts = customerName.split(' ');
        const createResponse = await squareClient.customersApi.createCustomer({
          givenName: nameParts[0],
          familyName: nameParts.slice(1).join(' ') || '',
          phoneNumber: customerPhone,
          emailAddress: customerEmail,
          note: `First booking: ${BOOKING_SOURCES.PHONE} on ${new Date().toLocaleDateString()}`
        });
        customerId = createResponse.result.customer.id;
        isNewCustomer = true;
      }
    } catch (error) {
      throw new Error(`Failed to find/create customer: ${error.message}`);
    }

    // Create booking
    const bookingResponse = await squareClient.bookingsApi.createBooking({
      booking: {
        locationId: LOCATION_ID,
        startAt: startTime,
        customerId: customerId,
        customerNote: BOOKING_SOURCES.PHONE,
        appointmentSegments: [{
          serviceVariationId: serviceVariationId,
          teamMemberId: teamMemberId,
          serviceVariationVersion: Date.now()
        }]
      },
      idempotencyKey: randomUUID()
    });

    res.json({
      success: true,
      booking: bookingResponse.result.booking,
      bookingSource: BOOKING_SOURCES.PHONE,
      message: `Appointment created successfully for ${customerName} at ${startTime}`,
      newCustomer: isNewCustomer
    });
  } catch (error) {
    console.error('createBooking error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Reschedule Existing Booking
 */
app.post('/tools/rescheduleBooking', async (req, res) => {
  try {
    const { bookingId, newStartTime } = req.body;

    if (!bookingId || !newStartTime) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: bookingId, newStartTime'
      });
    }

    const getResponse = await squareClient.bookingsApi.retrieveBooking(bookingId);
    const currentBooking = getResponse.result.booking;
    const originalSource = currentBooking.customerNote || BOOKING_SOURCES.PHONE;

    const updateResponse = await squareClient.bookingsApi.updateBooking(
      bookingId,
      {
        booking: {
          ...currentBooking,
          startAt: newStartTime,
          customerNote: `${originalSource} (Rescheduled via phone)`,
          version: currentBooking.version
        }
      }
    );

    res.json({
      success: true,
      booking: updateResponse.result.booking,
      message: `Appointment rescheduled to ${newStartTime}`
    });
  } catch (error) {
    console.error('rescheduleBooking error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Cancel Booking
 */
app.post('/tools/cancelBooking', async (req, res) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: bookingId'
      });
    }

    const getResponse = await squareClient.bookingsApi.retrieveBooking(bookingId);
    const currentBooking = getResponse.result.booking;

    const cancelResponse = await squareClient.bookingsApi.cancelBooking(
      bookingId,
      {
        bookingVersion: currentBooking.version
      }
    );

    res.json({
      success: true,
      booking: cancelResponse.result.booking,
      message: 'Appointment cancelled successfully'
    });
  } catch (error) {
    console.error('cancelBooking error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Lookup Booking by Phone
 */
app.post('/tools/lookupBooking', async (req, res) => {
  try {
    const { customerPhone, customerName } = req.body;

    if (!customerPhone) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: customerPhone'
      });
    }

    const searchResponse = await squareClient.customersApi.searchCustomers({
      query: {
        filter: {
          phoneNumber: {
            exact: customerPhone.replace(/\D/g, '')
          }
        }
      }
    });

    if (!searchResponse.result.customers || searchResponse.result.customers.length === 0) {
      return res.json({
        success: true,
        found: false,
        message: 'No customer found with that phone number'
      });
    }

    const customerId = searchResponse.result.customers[0].id;
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + 30);

    const bookingsResponse = await squareClient.bookingsApi.listBookings(
      undefined,
      undefined,
      customerId,
      undefined,
      LOCATION_ID,
      now.toISOString(),
      future.toISOString()
    );

    res.json({
      success: true,
      found: true,
      customer: searchResponse.result.customers[0],
      bookings: bookingsResponse.result.bookings || [],
      message: `Found ${bookingsResponse.result.bookings?.length || 0} upcoming bookings`
    });
  } catch (error) {
    console.error('lookupBooking error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * General Inquiry - Handles business hours, services, and team members
 * Single endpoint that routes to appropriate Square API based on inquiry type
 */
app.post('/tools/generalInquiry', async (req, res) => {
  try {
    const { inquiryType } = req.body;

    // Default to returning all info if no type specified
    const returnAll = !inquiryType;

    let result = {
      success: true
    };

    // Get business hours and location info
    if (returnAll || inquiryType === 'hours' || inquiryType === 'location') {
      try {
        const locationResponse = await squareClient.locationsApi.retrieveLocation(LOCATION_ID);
        const location = locationResponse.result.location;
        
        result.businessHours = location.businessHours || {};
        result.timezone = location.timezone || 'America/New_York';
        result.locationName = location.name;
        result.address = location.address;
        result.phoneNumber = location.phoneNumber;
      } catch (error) {
        console.error('Location API error:', error);
        result.businessHoursError = error.message;
      }
    }

    // Get services and pricing
    if (returnAll || inquiryType === 'services' || inquiryType === 'pricing') {
      try {
        const catalogResponse = await squareClient.catalogApi.listCatalog(
          undefined,
          'ITEM'
        );

        result.services = (catalogResponse.result.objects || []).map(item => ({
          id: item.id,
          name: item.itemData?.name,
          description: item.itemData?.description,
          variations: (item.itemData?.variations || []).map(variation => ({
            id: variation.id,
            name: variation.itemVariationData?.name,
            price: variation.itemVariationData?.priceMoney?.amount 
              ? (variation.itemVariationData.priceMoney.amount / 100).toFixed(2)
              : null,
            currency: variation.itemVariationData?.priceMoney?.currency || 'USD',
            duration: variation.itemVariationData?.serviceDuration
          }))
        }));
        result.servicesCount = result.services.length;
      } catch (error) {
        console.error('Catalog API error:', error);
        result.servicesError = error.message;
      }
    }

    // Get team members
    if (returnAll || inquiryType === 'staff' || inquiryType === 'barbers' || inquiryType === 'team') {
      try {
        const teamResponse = await squareClient.teamApi.searchTeamMembers({
          query: {
            filter: {
              locationIds: [LOCATION_ID],
              status: 'ACTIVE'
            }
          }
        });

        result.teamMembers = (teamResponse.result.teamMembers || []).map(member => ({
          id: member.id,
          givenName: member.givenName,
          familyName: member.familyName,
          fullName: `${member.givenName || ''} ${member.familyName || ''}`.trim(),
          emailAddress: member.emailAddress,
          phoneNumber: member.phoneNumber,
          isOwner: member.isOwner || false
        }));
        result.teamMembersCount = result.teamMembers.length;
      } catch (error) {
        console.error('Team API error:', error);
        result.teamMembersError = error.message;
      }
    }

    res.json(result);
  } catch (error) {
    console.error('generalInquiry error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== HEALTH & ANALYTICS =====
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Square Booking Server for ElevenLabs',
    version: '2.2.0 - Server Tools Format (6 tools)',
    sdkVersion: '43.0.2',
    endpoints: {
      serverTools: [
        'POST /tools/getAvailability',
        'POST /tools/createBooking',
        'POST /tools/rescheduleBooking',
        'POST /tools/cancelBooking',
        'POST /tools/lookupBooking',
        'POST /tools/generalInquiry'
      ],
      analytics: ['GET /analytics/sources']
    },
    bookingSources: BOOKING_SOURCES
  });
});

app.get('/analytics/sources', async (req, res) => {
  try {
    const now = new Date();
    const past30Days = new Date();
    past30Days.setDate(past30Days.getDate() - 30);

    const bookingsResponse = await squareClient.bookingsApi.listBookings(
      undefined,
      undefined,
      undefined,
      undefined,
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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Square Booking Server running on port ${PORT}`);
  console.log(`📍 Location: K BARBERSHOP (${LOCATION_ID})`);
  console.log(`🔧 Format: ElevenLabs Server Tools`);
  console.log(`📦 SDK: Square v43.0.2 (Legacy API)`);
  console.log(`📊 Booking sources configured:`, BOOKING_SOURCES);
  console.log(`\n🌐 Endpoints available (6 tools):`);
  console.log(`   POST /tools/getAvailability`);
  console.log(`   POST /tools/createBooking`);
  console.log(`   POST /tools/rescheduleBooking`);
  console.log(`   POST /tools/cancelBooking`);
  console.log(`   POST /tools/lookupBooking`);
  console.log(`   POST /tools/generalInquiry`);
});
