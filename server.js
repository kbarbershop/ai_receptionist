import express from 'express';
import { Client } from 'square';
import { randomUUID } from 'crypto';

const app = express();
app.use(express.json());

// Initialize Square client
const squareClient = new Client({
  bearerAuthCredentials: {
    accessToken: process.env.SQUARE_ACCESS_TOKEN
  },
  environment: process.env.SQUARE_ENVIRONMENT || 'production'
});

const LOCATION_ID = process.env.SQUARE_LOCATION_ID || 'LCS4MXPZP8J3M';
const PORT = process.env.PORT || 8080;

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Square MCP Server is running',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Service variation IDs mapping
const SERVICE_VARIATIONS = {
  'haircut': '7XPUHGDLY4N3H2OWTHMIABKF',
  'beard trim': 'LW6PKHXNUSWDQMLJ7HGDQ33Y',
  'haircut and beard': 'JXTC5KW3N47NRSZHONHHSBCL'
};

// Check availability endpoint
app.post('/tools/getAvailability', async (req, res) => {
  try {
    const { startDate, serviceVariationId } = req.body;
    
    console.log('Checking availability:', { startDate, serviceVariationId });
    
    const response = await squareClient.bookingsApi.searchAvailability({
      query: {
        filter: {
          startAtRange: {
            startAt: `${startDate}T00:00:00Z`,
            endAt: `${startDate}T23:59:59Z`
          },
          locationId: LOCATION_ID,
          bookingId: null
        }
      }
    });

    const availabilities = response.result.availabilities || [];
    
    res.json({
      success: true,
      slots: availabilities.map(slot => ({
        start_at: slot.startAt,
        appointment_segments: slot.appointmentSegments
      }))
    });
  } catch (error) {
    console.error('Availability error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create booking endpoint
app.post('/tools/createBooking', async (req, res) => {
  try {
    const { customerName, customerPhone, customerEmail, startAt, serviceVariationId, teamMemberId } = req.body;
    
    console.log('Creating booking:', req.body);

    // Create or get customer
    let customerId;
    try {
      const searchResponse = await squareClient.customersApi.searchCustomers({
        query: {
          filter: {
            phoneNumber: {
              exact: customerPhone
            }
          }
        }
      });

      if (searchResponse.result.customers && searchResponse.result.customers.length > 0) {
        customerId = searchResponse.result.customers[0].id;
      } else {
        const createResponse = await squareClient.customersApi.createCustomer({
          givenName: customerName,
          phoneNumber: customerPhone,
          emailAddress: customerEmail
        });
        customerId = createResponse.result.customer.id;
      }
    } catch (error) {
      console.error('Customer error:', error);
      throw error;
    }

    // Create booking
    const bookingResponse = await squareClient.bookingsApi.createBooking({
      booking: {
        startAt,
        locationId: LOCATION_ID,
        customerId,
        appointmentSegments: [{
          durationMinutes: 30,
          serviceVariationId,
          teamMemberId: teamMemberId || 'TMKzhB-WjsDff5rr',
          serviceVariationVersion: BigInt(Date.now())
        }]
      }
    });

    res.json({
      success: true,
      booking: bookingResponse.result.booking
    });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.errors || []
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server listening on port ${PORT}`);
  console.log(`Environment: ${process.env.SQUARE_ENVIRONMENT || 'production'}`);
  console.log(`Location ID: ${LOCATION_ID}`);
});