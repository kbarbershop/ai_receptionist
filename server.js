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

// MCP Protocol: List available tools
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
            customerName: {
              type: 'string',
              description: 'Customer full name'
            },
            customerPhone: {
              type: 'string',
              description: 'Customer phone number'
            },
            customerEmail: {
              type: 'string',
              description: 'Customer email address (optional)'
            },
            startTime: {
              type: 'string',
              description: 'Appointment start time in ISO 8601 format (e.g., 2025-10-15T14:00:00Z)'
            },
            serviceVariationId: {
              type: 'string',
              description: 'Service variation ID'
            },
            teamMemberId: {
              type: 'string',
              description: 'Team member ID (optional, will auto-assign if not provided)'
            }
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
            bookingId: {
              type: 'string',
              description: 'The booking ID to reschedule'
            },
            newStartTime: {
              type: 'string',
              description: 'New appointment start time in ISO 8601 format'
            }
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
            bookingId: {
              type: 'string',
              description: 'The booking ID to cancel'
            }
          },
          required: ['bookingId']
        }
      },
      {
        name: 'lookupBooking',
        description: 'Find existing bookings by customer phone number or name',
        inputSchema: {
          type: 'object',
          properties: {
            customerPhone: {
              type: 'string',
              description: 'Customer phone number to search'
            },
            customerName: {
              type: 'string',
              description: 'Customer name to search (optional)'
            }
          },
          required: ['customerPhone']
        }
      }
    ]
  });
});

// MCP Protocol: Execute tool
app.post('/mcp/call-tool', async (req, res) => {
  const { name, arguments: args } = req.body;

  try {
    let result;
    
    switch (name) {
      case 'getAvailability':
        result = await getAvailability(args);
        break;
      case 'createBooking':
        result = await createBooking(args);
        break;
      case 'rescheduleBooking':
        result = await rescheduleBooking(args);
        break;
      case 'cancelBooking':
        result = await cancelBooking(args);
        break;
      case 'lookupBooking':
        result = await lookupBooking(args);
        break;
      default:
        return res.status(400).json({ error: `Unknown tool: ${name}` });
    }

    res.json({ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
  } catch (error) {
    console.error(`Error executing ${name}:`, error);
    res.status(500).json({ 
      error: error.message,
      isError: true,
      content: [{ type: 'text', text: `Error: ${error.message}` }]
    });
  }
});

// Tool implementations
async function getAvailability(args) {
  const startDate = args.startDate || new Date().toISOString().split('T')[0];
  const startAt = new Date(startDate + 'T00:00:00Z');
  const endAt = new Date(startAt);
  endAt.setDate(endAt.getDate() + 7);

  const response = await squareClient.bookingsApi.searchAvailability({
    query: {
      filter: {
        locationId: LOCATION_ID,
        startAtRange: {
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString()
        }
      }
    }
  });

  return {
    availableSlots: response.result.availabilities || [],
    locationId: LOCATION_ID,
    searchPeriod: {
      start: startAt.toISOString(),
      end: endAt.toISOString()
    }
  };
}

async function createBooking(args) {
  // First, find or create customer
  let customerId;
  let isNewCustomer = false;
  
  try {
    const searchResponse = await squareClient.customersApi.searchCustomers({
      query: {
        filter: {
          phoneNumber: {
            exact: args.customerPhone.replace(/\D/g, '')
          }
        }
      }
    });

    if (searchResponse.result.customers && searchResponse.result.customers.length > 0) {
      customerId = searchResponse.result.customers[0].id;
    } else {
      // Create new customer with source tracking
      const createResponse = await squareClient.customersApi.createCustomer({
        givenName: args.customerName.split(' ')[0],
        familyName: args.customerName.split(' ').slice(1).join(' '),
        phoneNumber: args.customerPhone,
        emailAddress: args.customerEmail,
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
      startAt: args.startTime,
      customerId: customerId,
      customerNote: BOOKING_SOURCES.PHONE,
      appointmentSegments: [{
        serviceVariationId: args.serviceVariationId,
        teamMemberId: args.teamMemberId,
        serviceVariationVersion: Date.now()
      }]
    },
    idempotencyKey: randomUUID()
  });

  return {
    success: true,
    booking: bookingResponse.result.booking,
    bookingSource: BOOKING_SOURCES.PHONE,
    message: `Appointment created successfully for ${args.customerName} at ${args.startTime}`,
    newCustomer: isNewCustomer
  };
}

async function rescheduleBooking(args) {
  const getResponse = await squareClient.bookingsApi.retrieveBooking(args.bookingId);
  const currentBooking = getResponse.result.booking;
  const originalSource = currentBooking.customerNote || BOOKING_SOURCES.PHONE;

  const updateResponse = await squareClient.bookingsApi.updateBooking(
    args.bookingId,
    {
      booking: {
        ...currentBooking,
        startAt: args.newStartTime,
        customerNote: `${originalSource} (Rescheduled via phone)`,
        version: currentBooking.version
      }
    }
  );

  return {
    success: true,
    booking: updateResponse.result.booking,
    message: `Appointment rescheduled to ${args.newStartTime}`
  };
}

async function cancelBooking(args) {
  const getResponse = await squareClient.bookingsApi.retrieveBooking(args.bookingId);
  const currentBooking = getResponse.result.booking;

  const cancelResponse = await squareClient.bookingsApi.cancelBooking(
    args.bookingId,
    {
      bookingVersion: currentBooking.version
    }
  );

  return {
    success: true,
    booking: cancelResponse.result.booking,
    message: 'Appointment cancelled successfully'
  };
}

async function lookupBooking(args) {
  const searchResponse = await squareClient.customersApi.searchCustomers({
    query: {
      filter: {
        phoneNumber: {
          exact: args.customerPhone.replace(/\D/g, '')
        }
      }
    }
  });

  if (!searchResponse.result.customers || searchResponse.result.customers.length === 0) {
    return {
      found: false,
      message: 'No customer found with that phone number'
    };
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

  return {
    found: true,
    customer: searchResponse.result.customers[0],
    bookings: bookingsResponse.result.bookings || [],
    message: `Found ${bookingsResponse.result.bookings?.length || 0} upcoming bookings`
  };
}

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Square MCP Server',
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
  console.log(`Square MCP Server running on port ${PORT}`);
  console.log(`Location: K BARBERSHOP (${LOCATION_ID})`);
  console.log(`Booking sources configured:`, BOOKING_SOURCES);
});
