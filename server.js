import express from 'express';
import { Client } from 'square';
import { randomUUID } from 'crypto';

const app = express();
app.use(express.json());

// Initialize Square client
const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
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
// Each tool is now a separate REST endpoint

/**
 * Get Available Time Slots
 * Returns available appointment times for the next 7 days
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
 * Creates an appointment and tracks it came from phone
 */
app.post('/tools/createBooking', async (req, res) => {
  try {
    const { customerName, customerPhone, customerEmail, startTime, serviceVariationId, teamMemberId } = req.body;

    // Validate required fields
    if (!customerName || !customerPhone || !startTime || !serviceVariationId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: customerName, customerPhone, startTime, serviceVariationId'
      });
    }

    // First, find or create customer
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
        // Create new customer with source tracking
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

    // Create the booking with source identifier
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
 * Changes appointment time while preserving source tracking
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
 * Cancels an existing appointment
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
 * Finds customer and their upcoming appointments
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

// ===== LEGACY MCP ENDPOINTS (kept for backwards compatibility) =====
app.post('/mcp/list-tools', async (req, res) => {
  res.json({
    tools: [
      {
        name: 'getAvailability',
        description: 'Check available time slots for booking appointments. Returns available times for the next 7 days.',
        inputSchema: {
          type: 'object',
          properties: {
            startDate: {
              type: 'string',
              description: 'Start date in YYYY-MM-DD format (optional, defaults to today)'
            },
            serviceVariationId: {
              type: 'string',
              description: 'Specific service variation ID (optional)'
            }
          }
        }
      },
      {
        name: 'createBooking',
        description: 'Create a new appointment booking',
        inputSchema: {
          type: 'object',
          properties: {
            customerName: { type: 'string', description: 'Customer full name' },
            customerPhone: { type: 'string', description: 'Customer phone number' },
            customerEmail: { type: 'string', description: 'Customer email address (optional)' },
            startTime: { type: 'string', description: 'Appointment start time in ISO 8601 format' },
            serviceVariationId: { type: 'string', description: 'Service variation ID' },
            teamMemberId: { type: 'string', description: 'Team member ID (optional)' }
          },
          required: ['customerName', 'customerPhone', 'startTime', 'serviceVariationId']
        }
      },
      {
        name: 'rescheduleBooking',
        description: 'Reschedule an existing appointment',
        inputSchema: {
          type: 'object',
          properties: {
            bookingId: { type: 'string', description: 'The booking ID to reschedule' },
            newStartTime: { type: 'string', description: 'New appointment start time in ISO 8601 format' }
          },
          required: ['bookingId', 'newStartTime']
        }
      },
      {
        name: 'cancelBooking',
        description: 'Cancel an existing appointment',
        inputSchema: {
          type: 'object',
          properties: {
            bookingId: { type: 'string', description: 'The booking ID to cancel' }
          },
          required: ['bookingId']
        }
      },
      {
        name: 'lookupBooking',
        description: 'Find existing bookings by customer phone number',
        inputSchema: {
          type: 'object',
          properties: {
            customerPhone: { type: 'string', description: 'Customer phone number to search' },
            customerName: { type: 'string', description: 'Customer name (optional)' }
          },
          required: ['customerPhone']
        }
      }
    ]
  });
});

// ===== HEALTH & ANALYTICS =====
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Square Booking Server for ElevenLabs',
    version: '2.0.0 - Server Tools Format',
    endpoints: {
      serverTools: [
        'POST /tools/getAvailability',
        'POST /tools/createBooking',
        'POST /tools/rescheduleBooking',
        'POST /tools/cancelBooking',
        'POST /tools/lookupBooking'
      ],
      legacy: ['POST /mcp/list-tools'],
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
  console.log(`📊 Booking sources configured:`, BOOKING_SOURCES);
  console.log(`\n🌐 Endpoints available:`);
  console.log(`   POST /tools/getAvailability`);
  console.log(`   POST /tools/createBooking`);
  console.log(`   POST /tools/rescheduleBooking`);
  console.log(`   POST /tools/cancelBooking`);
  console.log(`   POST /tools/lookupBooking`);
});
