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

// Helper function to safely convert BigInt to string
const safeBigIntToString = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return value.toString();
  return String(value);
};

// Helper function to sanitize objects containing BigInt for JSON serialization
const sanitizeBigInt = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeBigInt(item));
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'bigint') {
      sanitized[key] = value.toString();
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeBigInt(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

// Helper function to normalize phone numbers to E.164 format
const normalizePhoneNumber = (phone) => {
  if (!phone) return null;
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If it already has country code (starts with 1 and has 11 digits), add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If it's a 10-digit US number, add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // If it's longer and doesn't start with +, add +
  if (digits.length > 10 && !phone.startsWith('+')) {
    return `+${digits}`;
  }
  
  // Return as-is if it already has + or doesn't match patterns
  return phone.startsWith('+') ? phone : `+${digits}`;
};

// 🐛 FIX: Helper function to format time slot for ElevenLabs with both snake_case and camelCase support
const formatTimeSlot = (slot) => {
  try {
    // Support both naming conventions from Square API
    const startAtField = slot.start_at || slot.startAt;
    
    if (!startAtField) {
      console.error('❌ Invalid slot - missing start_at/startAt:', JSON.stringify(slot));
      return slot;
    }

    const utcDate = new Date(startAtField);
    
    if (isNaN(utcDate.getTime())) {
      console.error('❌ Invalid date:', startAtField);
      return slot;
    }
    
    // Convert to EDT using toLocaleString with America/New_York timezone
    const edtString = utcDate.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    // Parse the EDT string to get hours and minutes
    const [datePart, timePart] = edtString.split(', ');
    const [month, day, year] = datePart.split('/');
    const [hours, minutes, seconds] = timePart.split(':');
    
    // Create ISO string for EDT
    const edtISOString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hours}:${minutes}:${seconds}-04:00`;
    
    // Format as 12-hour time
    const hour24 = parseInt(hours, 10);
    const period = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 || 12;
    const minuteStr = minutes.toString().padStart(2, '0');
    
    const formatted = {
      ...slot,
      start_at_utc: startAtField,
      start_at_edt: edtISOString,
      human_readable: `${hour12}:${minuteStr} ${period}`,
      time_24h: `${hours}:${minuteStr}`
    };
    
    return formatted;
  } catch (error) {
    console.error('❌ Error formatting time slot:', error, slot);
    return slot;
  }
};

// ===== ELEVENLABS SERVER TOOLS ENDPOINTS =====

/**
 * Get Available Time Slots
 */
app.post('/tools/getAvailability', async (req, res) => {
  try {
    // Accept both 'startDate' (YYYY-MM-DD) and 'datetime' (ISO 8601) for backwards compatibility
    const { startDate, datetime, serviceVariationId, teamMemberId } = req.body;
    
    console.log(`🔍 getAvailability called:`, { startDate, datetime, serviceVariationId, teamMemberId });
    
    // Parse the requested datetime - prefer startDate if provided
    let requestedTime = null;
    let isDateOnly = false;
    const timeInput = startDate || datetime;
    
    if (timeInput) {
      // If startDate is YYYY-MM-DD format (date only, no time)
      if (startDate && startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        isDateOnly = true;
        // Don't set a specific time, we'll search the whole day
        console.log(`📅 Requested date only (no specific time): ${startDate}`);
      } else if (timeInput) {
        requestedTime = new Date(timeInput);
        console.log(`📅 Requested specific time: ${requestedTime.toISOString()} (${timeInput})`);
      }
    }
    
    // Set search window
    let startAt, endAt;
    if (isDateOnly && startDate) {
      // Search the entire day requested
      startAt = new Date(startDate + 'T00:00:00-04:00');
      endAt = new Date(startDate + 'T23:59:59-04:00');
      console.log(`🔍 Searching full day: ${startAt.toISOString()} to ${endAt.toISOString()}`);
    } else if (requestedTime && !isNaN(requestedTime.getTime())) {
      // Search ±2 hours around specific time
      startAt = new Date(requestedTime.getTime() - (2 * 60 * 60 * 1000));
      endAt = new Date(requestedTime.getTime() + (2 * 60 * 60 * 1000));
    } else {
      // No date/time specified, search next 7 days
      startAt = new Date();
      endAt = new Date();
      endAt.setDate(endAt.getDate() + 7);
    }

    // Build segment filter
    const segmentFilter = {
      serviceVariationId: serviceVariationId
    };
    
    // Add team member filter if specified
    if (teamMemberId) {
      segmentFilter.teamMemberIdFilter = {
        any: [teamMemberId]
      };
    } else {
      segmentFilter.teamMemberIdFilter = {
        any: []
      };
    }

    const response = await squareClient.bookingsApi.searchAvailability({
      query: {
        filter: {
          locationId: LOCATION_ID,
          startAtRange: {
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString()
          },
          segmentFilters: [segmentFilter]
        }
      }
    });

    // Sanitize and format slots
    const rawSlots = sanitizeBigInt(response.result.availabilities || []);
    console.log(`✅ Found ${rawSlots.length} raw slots from Square API`);
    
    // 🐛 FIX: Log first raw slot to debug field names
    if (rawSlots.length > 0) {
      console.log(`📋 First raw slot structure:`, JSON.stringify(rawSlots[0]).substring(0, 200));
    }
    
    const formattedSlots = rawSlots.map(formatTimeSlot);
    
    // 🐛 FIX: Enhanced logging to debug formatting
    if (formattedSlots.length > 0) {
      console.log(`✅ Successfully formatted ${formattedSlots.length} slots`);
      console.log(`   First slot human_readable: ${formattedSlots[0].human_readable}`);
      console.log(`   First slot start_at_utc: ${formattedSlots[0].start_at_utc}`);
      console.log(`   Last slot human_readable: ${formattedSlots[formattedSlots.length - 1].human_readable}`);
    } else {
      console.log(`⚠️ No slots were formatted (formattedSlots.length = 0)`);
    }
    
    // Check if the exact requested time is available (only if specific time was provided)
    let exactMatch = null;
    if (requestedTime && !isNaN(requestedTime.getTime()) && !isDateOnly) {
      const requestedTimeUTC = requestedTime.toISOString();
      exactMatch = formattedSlots.find(slot => slot.start_at_utc === requestedTimeUTC);
      
      if (exactMatch) {
        console.log(`✅ EXACT MATCH FOUND: ${exactMatch.human_readable}`);
        
        // Return success with exact match
        return res.json({
          success: true,
          isAvailable: true,
          requestedTime: requestedTimeUTC,
          requestedTimeFormatted: exactMatch.human_readable,
          slot: exactMatch,
          message: `Yes, ${exactMatch.human_readable} is available`
        });
      } else {
        console.log(`❌ Exact time NOT available, finding closest alternatives...`);
        
        // Find 3-5 closest alternative times
        const alternatives = formattedSlots
          .map(slot => ({
            ...slot,
            timeDiff: Math.abs(new Date(slot.start_at_utc).getTime() - requestedTime.getTime())
          }))
          .sort((a, b) => a.timeDiff - b.timeDiff)
          .slice(0, 5)
          .map(({ timeDiff, ...slot }) => slot);
        
        const altTimes = alternatives.map(a => a.human_readable).join(', ');
        console.log(`📋 Closest alternatives: ${altTimes}`);
        
        return res.json({
          success: true,
          isAvailable: false,
          requestedTime: requestedTimeUTC,
          closestAlternatives: alternatives,
          message: `That time is not available. The closest available times are: ${altTimes}`
        });
      }
    }
    
    // 🔥 FIX: Return ALL slots so AI knows actual first and last appointment times
    if (formattedSlots.length > 0) {
      const firstTime = formattedSlots[0].human_readable;
      const lastTime = formattedSlots[formattedSlots.length - 1].human_readable;
      console.log(`   Returning ${formattedSlots.length} slots: ${firstTime} to ${lastTime}`);
      
      res.json({
        success: true,
        availableSlots: formattedSlots,
        totalCount: formattedSlots.length,
        firstAvailable: firstTime,
        lastAvailable: lastTime,
        message: `We have ${formattedSlots.length} available times from ${firstTime} to ${lastTime}`
      });
    } else {
      res.json({
        success: true,
        availableSlots: [],
        totalCount: 0,
        message: 'No available times found'
      });
    }
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

    console.log(`📅 createBooking called:`, { 
      customerName, 
      customerPhone, 
      startTime, 
      serviceVariationId, 
      teamMemberId 
    });

    if (!customerName || !customerPhone || !startTime || !serviceVariationId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: customerName, customerPhone, startTime, serviceVariationId'
      });
    }

    // Default team member if not provided
    const finalTeamMemberId = teamMemberId || 'TMKzhB-WjsDff5rr';
    console.log(`👤 Using team member: ${finalTeamMemberId}`);

    // 🔥 FIX: Keep the + prefix for Square Customer API (they support +15551234567 format)
    const normalizedPhone = normalizePhoneNumber(customerPhone);
    console.log(`📞 Phone normalization: "${customerPhone}" → "${normalizedPhone}"`);

    // Find or create customer
    let customerId;
    let isNewCustomer = false;
    
    try {
      // Try searching with multiple phone formats to handle existing customers
      const phoneFormats = [
        normalizedPhone,                      // +15716995142
        normalizedPhone.replace(/^\+/, ''),   // 15716995142 (without +)
        normalizedPhone.replace(/^\+1/, '')   // 5716995142 (10 digits only)
      ];
      
      let searchResponse;
      let foundCustomer = false;
      
      for (const phoneFormat of phoneFormats) {
        searchResponse = await squareClient.customersApi.searchCustomers({
          query: {
            filter: {
              phoneNumber: {
                exact: phoneFormat
              }
            }
          }
        });
        
        if (searchResponse.result.customers && searchResponse.result.customers.length > 0) {
          foundCustomer = true;
          console.log(`✅ Found existing customer with phone format: ${phoneFormat}`);
          break;
        }
      }

      if (foundCustomer) {
        customerId = searchResponse.result.customers[0].id;
        console.log(`✅ Found existing customer: ${customerId}`);
      } else {
        const nameParts = customerName.split(' ');
        const createResponse = await squareClient.customersApi.createCustomer({
          idempotency_key: randomUUID(),
          given_name: nameParts[0],
          family_name: nameParts.slice(1).join(' ') || '',
          phone_number: normalizedPhone,  // Use +15716995142 format
          email_address: customerEmail,
          note: `First booking: ${BOOKING_SOURCES.PHONE} on ${new Date().toLocaleDateString()}`
        });
        customerId = createResponse.result.customer.id;
        isNewCustomer = true;
        console.log(`✅ Created new customer: ${customerId}`);
      }
    } catch (error) {
      console.error('Customer find/create error details:', error);
      throw new Error(`Failed to find/create customer: ${error.message}`);
    }

    // Parse startTime - convert EDT to UTC if needed
    let bookingStartTime = startTime;
    
    // Check if time is in EDT format (ends with -04:00)
    if (startTime.includes('-04:00')) {
      // Convert EDT to UTC
      const edtDate = new Date(startTime);
      bookingStartTime = edtDate.toISOString(); // This converts to UTC with Z
      console.log(`🕐 Converted EDT to UTC: ${startTime} → ${bookingStartTime}`);
    } else if (startTime.includes('human_readable') || startTime.includes('start_at_edt')) {
      // Agent sent the formatted object - extract UTC time
      try {
        const timeObj = JSON.parse(startTime);
        bookingStartTime = timeObj.start_at_utc || timeObj.start_at;
      } catch {
        // Just use as-is if not JSON
      }
    }

    console.log(`⏰ Booking time (UTC): ${bookingStartTime}`);

    // Create booking
    const bookingResponse = await squareClient.bookingsApi.createBooking({
      booking: {
        locationId: LOCATION_ID,
        startAt: bookingStartTime,
        customerId: customerId,
        customerNote: BOOKING_SOURCES.PHONE,
        appointmentSegments: [{
          serviceVariationId: serviceVariationId,
          teamMemberId: finalTeamMemberId,
          serviceVariationVersion: BigInt(Date.now())
        }]
      },
      idempotencyKey: randomUUID()
    });

    const booking = sanitizeBigInt(bookingResponse.result.booking);
    console.log(`✅ Booking created: ${booking.id}`);

    res.json({
      success: true,
      booking: booking,
      bookingSource: BOOKING_SOURCES.PHONE,
      message: `Appointment created successfully for ${customerName}`,
      newCustomer: isNewCustomer
    });
  } catch (error) {
    console.error('❌ createBooking error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.errors || []
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

    const booking = sanitizeBigInt(updateResponse.result.booking);

    res.json({
      success: true,
      booking: booking,
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

    const booking = sanitizeBigInt(cancelResponse.result.booking);

    res.json({
      success: true,
      booking: booking,
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

    const normalizedPhone = normalizePhoneNumber(customerPhone);

    // Try multiple phone formats for searching
    const phoneFormats = [
      normalizedPhone,                      // +15716995142
      normalizedPhone.replace(/^\+/, ''),   // 15716995142
      normalizedPhone.replace(/^\+1/, '')   // 5716995142
    ];

    let searchResponse;
    let found = false;

    for (const phoneFormat of phoneFormats) {
      searchResponse = await squareClient.customersApi.searchCustomers({
        query: {
          filter: {
            phoneNumber: {
              exact: phoneFormat
            }
          }
        }
      });

      if (searchResponse.result.customers && searchResponse.result.customers.length > 0) {
        found = true;
        break;
      }
    }

    if (!found) {
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

    const customer = sanitizeBigInt(searchResponse.result.customers[0]);
    const bookings = sanitizeBigInt(bookingsResponse.result.bookings || []);

    res.json({
      success: true,
      found: true,
      customer: customer,
      bookings: bookings,
      message: `Found ${bookings.length} upcoming bookings`
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
 * General Inquiry
 */
app.post('/tools/generalInquiry', async (req, res) => {
  try {
    const { inquiryType } = req.body;
    const returnAll = !inquiryType;

    let result = { success: true };

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

    if (returnAll || inquiryType === 'services' || inquiryType === 'pricing') {
      try {
        const catalogResponse = await squareClient.catalogApi.listCatalog(undefined, 'ITEM');

        result.services = (catalogResponse.result.objects || []).map(item => ({
          id: item.id,
          name: item.itemData?.name,
          description: item.itemData?.description,
          variations: (item.itemData?.variations || []).map(variation => ({
            id: variation.id,
            name: variation.itemVariationData?.name,
            price: variation.itemVariationData?.priceMoney?.amount 
              ? (Number(variation.itemVariationData.priceMoney.amount) / 100).toFixed(2)
              : null,
            currency: variation.itemVariationData?.priceMoney?.currency || 'USD',
            duration: safeBigIntToString(variation.itemVariationData?.serviceDuration)
          }))
        }));
        result.servicesCount = result.services.length;
      } catch (error) {
        console.error('Catalog API error:', error);
        result.servicesError = error.message;
      }
    }

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
    version: '2.3.6 - Phone Format Fix',
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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Square Booking Server running on port ${PORT}`);
  console.log(`📍 Location: K BARBERSHOP (${LOCATION_ID})`);
  console.log(`🔧 Format: ElevenLabs Server Tools`);
  console.log(`📦 SDK: Square v43.0.2 (Legacy API)`);
  console.log(`📊 Booking sources configured:`, BOOKING_SOURCES);
  console.log(`📞 Phone format: E.164 with + prefix (e.g., +15716995142)`);
  console.log(`🕐 Formatting times in human-readable EDT format with correct UTC conversion`);
  console.log(`🐛 Field compatibility: snake_case + camelCase support enabled`);
  console.log(`🔥 Returns ALL availability slots (not just first 10)`);
  console.log(`\n🌐 Endpoints available (6 tools):`);
  console.log(`   POST /tools/getAvailability`);
  console.log(`   POST /tools/createBooking`);
  console.log(`   POST /tools/rescheduleBooking`);
  console.log(`   POST /tools/cancelBooking`);
  console.log(`   POST /tools/lookupBooking`);
  console.log(`   POST /tools/generalInquiry`);
});
