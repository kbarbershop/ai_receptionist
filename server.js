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

// 🔥 NEW: Service name to variation ID mapping
const SERVICE_MAPPINGS = {
  'Regular Haircut': '7XPUHGDLY4N3H2OWTHMIABKF',
  'Beard Trim': 'SPUX6LRBS6RHFBX3MSRASG2J',
  'Beard Sculpt': 'UH5JRVCJGAB2KISNBQ7KMVVQ',
  'Ear Waxing': 'ALZZEN4DO6JCNMC6YPXN6DPH',
  'Nose Waxing': 'VVGK7I7L6BHTG7LFKLAIRHBZ',
  'Eyebrow Waxing': '3TV5CVRXCB62BWIWVY6OCXIC',
  'Paraffin': '7ND6OIFTRLJEPMDBBI3B3ELT',
  'Gold': '7UKWUIF4CP7YR27FI52DWPEN',
  'Silver': '7PFUQVFMALHIPDAJSYCBKBYV'
};

// Helper function to get current date/time in EDT
const getCurrentEDT = () => {
  const now = new Date();
  const edtString = now.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'long'
  });
  
  return {
    utc: now.toISOString(),
    edt: edtString,
    timestamp: now.getTime()
  };
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

// 🔥 v2.7.6 FIX: Helper function to format UTC time to EDT human-readable format with explicit month names
const formatUTCtoEDT = (utcTimeString) => {
  if (!utcTimeString) return null;
  
  try {
    const utcDate = new Date(utcTimeString);
    
    if (isNaN(utcDate.getTime())) {
      console.error('❌ Invalid date:', utcTimeString);
      return utcTimeString;
    }
    
    // Convert to EDT with explicit month name and weekday
    const formatted = utcDate.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',  // Mon, Tue, Wed, etc.
      month: 'short',    // Jan, Feb, Mar, etc.
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    return `${formatted} EDT`;
  } catch (error) {
    console.error('❌ Error formatting time:', error);
    return utcTimeString;
  }
};

// Helper function to format time slot for ElevenLabs with both snake_case and camelCase support
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

// 🔥 NEW: Helper function to get service duration in milliseconds
const getServiceDuration = (serviceVariationId) => {
  const durations = {
    '7XPUHGDLY4N3H2OWTHMIABKF': 1800000, // Regular Haircut - 30 min
    'SPUX6LRBS6RHFBX3MSRASG2J': 1800000, // Beard Trim - 30 min
    'UH5JRVCJGAB2KISNBQ7KMVVQ': 1800000, // Beard Sculpt - 30 min
    'ALZZEN4DO6JCNMC6YPXN6DPH': 600000,  // Ear Waxing - 10 min
    'VVGK7I7L6BHTG7LFKLAIRHBZ': 600000,  // Nose Waxing - 10 min
    '3TV5CVRXCB62BWIWVY6OCXIC': 600000,  // Eyebrow Waxing - 10 min
    '7ND6OIFTRLJEPMDBBI3B3ELT': 1800000, // Paraffin - 30 min
    '7UKWUIF4CP7YR27FI52DWPEN': 5400000, // Gold - 90 min
    '7PFUQVFMALHIPDAJSYCBKBYV': 3600000  // Silver - 60 min
  };
  return durations[serviceVariationId] || 1800000; // Default 30 min
};

// ===== ELEVENLABS SERVER TOOLS ENDPOINTS =====

/**
 * 🆕 Get Current Date/Time - Provides context to the AI agent
 */
app.post('/tools/getCurrentDateTime', async (req, res) => {
  try {
    const now = new Date();
    
    // Get current time in EDT
    const edtString = now.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    // Calculate next Thursday
    const nextThursday = new Date(now);
    const daysUntilThursday = (4 - now.getDay() + 7) % 7 || 7;
    nextThursday.setDate(now.getDate() + daysUntilThursday);
    
    const nextThursdayString = nextThursday.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    
    // Calculate tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    
    const tomorrowString = tomorrow.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    
    res.json({
      success: true,
      current: {
        dateTime: edtString,
        timezone: 'America/New_York (EDT)',
        utc: now.toISOString()
      },
      context: {
        tomorrow: tomorrowString,
        nextThursday: nextThursdayString,
        message: `Today is ${edtString}. When the customer says 'thursday', they mean ${nextThursdayString}. When they say 'tomorrow', they mean ${tomorrowString}.`
      }
    });
  } catch (error) {
    console.error('getCurrentDateTime error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get Available Time Slots - NOW FILTERS OUT ALREADY-BOOKED SLOTS!
 * 🔥 v2.7.7: ENHANCED ERROR LOGGING for Square API errors
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
      // 🔥 FIX v2.7.5: Check if date is in the past BEFORE calculating times
      const now = new Date();
      const requestedDate = new Date(startDate + 'T00:00:00-04:00');
      const endOfRequestedDate = new Date(startDate + 'T23:59:59-04:00');
      
      // If the ENTIRE requested date is in the past, reject it
      if (endOfRequestedDate < now) {
        console.log(`⛔ Requested date ${startDate} is completely in the past`);
        return res.json({
          success: true,
          availableSlots: [],
          totalCount: 0,
          message: 'That date has already passed. Please choose a future date.'
        });
      }
      
      // Use the LATER of midnight OR current time as the start
      startAt = now > requestedDate ? now : requestedDate;
      endAt = endOfRequestedDate;
      
      if (now > requestedDate) {
        console.log(`⏰ Adjusted start time: midnight (${requestedDate.toISOString()}) was in the past, using now (${now.toISOString()}) instead`);
      }
      
      console.log(`🔍 Searching date ${startDate}: ${startAt.toISOString()} to ${endAt.toISOString()}`);
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

    // 🔥 v2.7.4 FIX: Validate time range before making API call
    if (startAt >= endAt) {
      console.log(`⚠️ Invalid time range: start_at (${startAt.toISOString()}) >= end_at (${endAt.toISOString()})`);
      return res.json({
        success: true,
        availableSlots: [],
        totalCount: 0,
        message: 'No available times - the requested time is outside business hours'
      });
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

    // 🔥 v2.7.7: Log the exact parameters being sent to Square API
    const apiParams = {
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
    };
    console.log(`🔧 Calling Square searchAvailability with:`, JSON.stringify(apiParams, null, 2));

    const response = await squareClient.bookingsApi.searchAvailability(apiParams);

    // Get raw availability slots
    const rawSlots = sanitizeBigInt(response.result.availabilities || []);
    console.log(`✅ Found ${rawSlots.length} raw slots from Square API`);
    
    // 🔥 v2.7.2 FIX: Fetch existing bookings and EXCLUDE CANCELLED ones
    const bookingsResponse = await squareClient.bookingsApi.listBookings(
      undefined, // limit
      undefined, // cursor
      undefined, // customer_id
      undefined, // team_member_id
      LOCATION_ID,
      startAt.toISOString(),
      endAt.toISOString()
    );
    
    const existingBookings = bookingsResponse.result.bookings || [];
    
    // 🔥 FIX: Only consider ACTIVE bookings (not cancelled)
    const activeBookings = existingBookings.filter(b => 
      b.status !== 'CANCELLED_BY_SELLER' && 
      b.status !== 'CANCELLED_BY_CUSTOMER'
    );
    
    const bookedTimes = new Set(activeBookings.map(b => b.startAt));
    
    console.log(`📋 Found ${existingBookings.length} total bookings (${activeBookings.length} active, ${existingBookings.length - activeBookings.length} cancelled)`);
    if (activeBookings.length > 0) {
      console.log(`🚫 Actually booked times:`, Array.from(bookedTimes));
    }
    
    // Filter out already-booked slots
    const availableSlots = rawSlots.filter(slot => {
      const slotTime = slot.start_at || slot.startAt;
      return !bookedTimes.has(slotTime);
    });
    
    console.log(`✅ After filtering: ${availableSlots.length} truly available slots (removed ${rawSlots.length - availableSlots.length} booked slots)`);
    
    const formattedSlots = availableSlots.map(formatTimeSlot);
    
    // Enhanced logging
    if (formattedSlots.length > 0) {
      console.log(`✅ Successfully formatted ${formattedSlots.length} slots`);
      console.log(`   First slot human_readable: ${formattedSlots[0].human_readable}`);
      console.log(`   First slot start_at_utc: ${formattedSlots[0].start_at_utc}`);
      console.log(`   Last slot human_readable: ${formattedSlots[formattedSlots.length - 1].human_readable}`);
    } else {
      console.log(`⚠️ No slots available after filtering`);
    }
    
    // 🔥 v2.7.0 FIX: Check if the exact requested time is available with 1-minute tolerance
    let exactMatch = null;
    if (requestedTime && !isNaN(requestedTime.getTime()) && !isDateOnly) {
      const requestedTimeMs = requestedTime.getTime();
      console.log(`🔍 Looking for time match within 1 minute of: ${requestedTime.toISOString()}`);
      
      // Find slot within 1 minute (60000 ms) of requested time
      exactMatch = formattedSlots.find(slot => {
        const slotTimeMs = new Date(slot.start_at_utc).getTime();
        const timeDiff = Math.abs(slotTimeMs - requestedTimeMs);
        console.log(`   Checking slot ${slot.human_readable}: diff = ${timeDiff}ms`);
        return timeDiff < 60000; // Within 1 minute
      });
      
      if (exactMatch) {
        console.log(`✅ TIME MATCH FOUND: ${exactMatch.human_readable} (within 1 minute tolerance)`);
        
        // Return success with exact match
        return res.json({
          success: true,
          isAvailable: true,
          requestedTime: requestedTime.toISOString(),
          requestedTimeFormatted: exactMatch.human_readable,
          slot: exactMatch,
          message: `Yes, ${exactMatch.human_readable} is available`
        });
      } else {
        console.log(`❌ No time match found within 1 minute tolerance, finding closest alternatives...`);
        
        // Find 3-5 closest alternative times
        const alternatives = formattedSlots
          .map(slot => ({
            ...slot,
            timeDiff: Math.abs(new Date(slot.start_at_utc).getTime() - requestedTimeMs)
          }))
          .sort((a, b) => a.timeDiff - b.timeDiff)
          .slice(0, 5)
          .map(({ timeDiff, ...slot }) => slot);
        
        const altTimes = alternatives.map(a => a.human_readable).join(', ');
        console.log(`📋 Closest alternatives: ${altTimes}`);
        
        return res.json({
          success: true,
          isAvailable: false,
          requestedTime: requestedTime.toISOString(),
          closestAlternatives: alternatives,
          message: `That time is not available. The closest available times are: ${altTimes}`
        });
      }
    }
    
    // Return ALL truly available slots
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
    // 🔥 v2.7.7: Enhanced error logging - capture Square API details
    console.error('❌ getAvailability error:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    // Log detailed error information from Square API
    if (error.errors && Array.isArray(error.errors)) {
      console.error('❌ Square API errors:', JSON.stringify(error.errors, null, 2));
    }
    if (error.result && error.result.errors) {
      console.error('❌ Square result errors:', JSON.stringify(error.result.errors, null, 2));
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.errors || error.result?.errors || []
    });
  }
});

/**
 * Create New Booking
 * 🔥 v2.8.1 FIX: Keep + prefix when searching for customers
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

    // Normalize phone to +15716995142 format
    const normalizedPhone = normalizePhoneNumber(customerPhone);
    console.log(`📞 Phone normalization: "${customerPhone}" → "${normalizedPhone}"`);

    // Find or create customer
    let customerId;
    let isNewCustomer = false;
    
    try {
      // 🔥 FIX: Try ONLY the +1 format first for new searches
      let searchResponse = await squareClient.customersApi.searchCustomers({
        query: {
          filter: {
            phoneNumber: {
              exact: normalizedPhone  // Keep the + prefix!
            }
          }
        }
      });
      
      if (searchResponse.result.customers && searchResponse.result.customers.length > 0) {
        customerId = searchResponse.result.customers[0].id;
        console.log(`✅ Found existing customer with phone: ${normalizedPhone}`);
      } else {
        // Customer not found, create new
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
      // 🔥 v2.8.0: ENHANCED error logging for customer creation failures
      console.error('❌ Customer find/create error details:', {
        message: error.message,
        statusCode: error.statusCode,
        phone: normalizedPhone,
        name: customerName,
        email: customerEmail || 'not provided',
        errors: JSON.stringify(error.errors || [], null, 2),
        result: JSON.stringify(error.result || {}, null, 2)
      });
      
      // Log the full error object for debugging
      console.error('❌ Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
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
      bookingId: booking.id,
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
 * 🔥 FIXED: Add Services to Existing Booking - NO OVERLAPS ALLOWED
 * This handles adding multiple services to an existing appointment
 */
app.post('/tools/addServicesToBooking', async (req, res) => {
  try {
    const { bookingId, serviceNames } = req.body;

    console.log(`➕ addServicesToBooking called:`, { bookingId, serviceNames });

    if (!bookingId || !serviceNames || !Array.isArray(serviceNames) || serviceNames.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: bookingId and serviceNames (array)'
      });
    }

    // Get existing booking
    const getResponse = await squareClient.bookingsApi.retrieveBooking(bookingId);
    const currentBooking = getResponse.result.booking;
    
    console.log(`📋 Current booking has ${currentBooking.appointmentSegments.length} service(s)`);

    // Get current team member (barber)
    const currentTeamMemberId = currentBooking.appointmentSegments[0].teamMemberId;
    console.log(`👤 Current barber: ${currentTeamMemberId}`);

    // Convert service names to variation IDs
    const newSegments = [];
    const invalidServices = [];
    
    for (const serviceName of serviceNames) {
      const variationId = SERVICE_MAPPINGS[serviceName];
      if (!variationId) {
        invalidServices.push(serviceName);
        continue;
      }

      newSegments.push({
        serviceVariationId: variationId,
        teamMemberId: currentTeamMemberId,
        serviceVariationVersion: BigInt(Date.now())
      });
    }

    if (invalidServices.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid service names: ${invalidServices.join(', ')}. Valid names are: ${Object.keys(SERVICE_MAPPINGS).join(', ')}`
      });
    }

    // Calculate total duration to check for time conflicts
    const currentDuration = getServiceDuration(currentBooking.appointmentSegments[0].serviceVariationId);
    const additionalDuration = newSegments.reduce((total, seg) => total + getServiceDuration(seg.serviceVariationId), 0);
    const totalDuration = currentDuration + additionalDuration;

    const bookingStart = new Date(currentBooking.startAt);
    const bookingEnd = new Date(bookingStart.getTime() + totalDuration);

    console.log(`⏱️  Current duration: ${currentDuration / 60000} min, Additional: ${additionalDuration / 60000} min, Total: ${totalDuration / 60000} min`);
    console.log(`🕐 Booking window: ${bookingStart.toISOString()} to ${bookingEnd.toISOString()}`);

    // 🔥 FIX: Check for OVERLAPS (not just conflicts at the exact end time)
    // We need to check if ANY booking exists that would overlap with our extended time
    const checkStart = new Date(bookingStart.getTime() + currentDuration); // Start checking from where current booking ends
    const checkEnd = new Date(bookingEnd.getTime() + (60 * 60 * 1000)); // Check 1 hour ahead
    
    console.log(`🔍 Checking for overlaps from ${checkStart.toISOString()} to ${checkEnd.toISOString()}`);
    
    const conflictResponse = await squareClient.bookingsApi.listBookings(
      undefined, undefined, undefined, currentTeamMemberId,
      LOCATION_ID,
      checkStart.toISOString(),
      checkEnd.toISOString()
    );

    // 🔥 FIX: Filter out cancelled bookings AND the current booking
    const potentialConflicts = (conflictResponse.result.bookings || []).filter(b => 
      b.id !== bookingId && 
      b.status !== 'CANCELLED_BY_SELLER' && 
      b.status !== 'CANCELLED_BY_CUSTOMER'
    );
    
    console.log(`📋 Found ${potentialConflicts.length} active bookings to check`);
    
    // Check if any of these bookings would OVERLAP (not just touch)
    let hasOverlap = false;
    let conflictingBooking = null;
    
    for (const booking of potentialConflicts) {
      const nextBookingStart = new Date(booking.startAt);
      
      console.log(`  Checking booking at ${nextBookingStart.toISOString()}`);
      console.log(`  Our extended booking ends at ${bookingEnd.toISOString()}`);
      
      // OVERLAP happens if next booking starts BEFORE our extended booking ends
      // Back-to-back is OK (nextBookingStart == bookingEnd)
      if (nextBookingStart < bookingEnd) {
        hasOverlap = true;
        conflictingBooking = booking;
        console.log(`  ❌ OVERLAP DETECTED! Next booking starts before we finish`);
        break;
      } else {
        console.log(`  ✅ No overlap - back-to-back or later is OK`);
      }
    }
    
    if (hasOverlap && conflictingBooking) {
      const nextBookingTime = formatUTCtoEDT(conflictingBooking.startAt);
      return res.json({
        success: false,
        hasConflict: true,
        message: `I cannot add these services to your ${formatUTCtoEDT(currentBooking.startAt)} appointment because we have another customer scheduled at ${nextBookingTime}. The additional services would take ${additionalDuration / 60000} minutes and would overlap with the next appointment. Would you like to book a separate appointment, or when you arrive, you can ask the barber if they have time to add these services.`,
        nextBooking: nextBookingTime,
        additionalDuration: additionalDuration / 60000
      });
    }

    // No overlap - update booking with all segments
    const allSegments = [...currentBooking.appointmentSegments, ...newSegments];

    const updateResponse = await squareClient.bookingsApi.updateBooking(
      bookingId,
      {
        booking: {
          ...currentBooking,
          appointmentSegments: allSegments,
          version: currentBooking.version
        }
      }
    );

    const updatedBooking = sanitizeBigInt(updateResponse.result.booking);
    console.log(`✅ Updated booking ${bookingId} with ${newSegments.length} additional service(s)`);

    res.json({
      success: true,
      booking: updatedBooking,
      servicesAdded: serviceNames,
      totalServices: allSegments.length,
      message: `Successfully added ${serviceNames.join(', ')} to your appointment. Your appointment will now take approximately ${totalDuration / 60000} minutes.`
    });

  } catch (error) {
    console.error('❌ addServicesToBooking error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.errors || []
    });
  }
});

/**
 * Reschedule Existing Booking - 🔥 v2.7.9 FIX: Timezone validation and auto-correction
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

    console.log(`📅 rescheduleBooking called:`, { bookingId, newStartTime });

    // 🔥 NEW: Validate and fix timezone
    let finalStartTime = newStartTime;
    
    // Check if timezone offset is missing
    if (!newStartTime.includes('-04:00') && !newStartTime.includes('-05:00') && !newStartTime.includes('Z')) {
      console.log(`⚠️ WARNING: newStartTime missing timezone offset: ${newStartTime}`);
      
      // Parse the time and assume it's meant to be EDT
      const dateObj = new Date(newStartTime);
      
      // Get EDT offset (currently -04:00, changes to -05:00 in winter)
      const now = new Date();
      const isEDT = now.getMonth() >= 2 && now.getMonth() < 10; // March-October
      const offset = isEDT ? '-04:00' : '-05:00';
      
      // Reconstruct with proper timezone
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      const seconds = String(dateObj.getSeconds()).padStart(2, '0');
      
      finalStartTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offset}`;
      console.log(`✅ Fixed timezone: ${newStartTime} → ${finalStartTime}`);
    }
    
    // 🔥 NEW: If time ends with Z (UTC), convert to EDT
    if (finalStartTime.endsWith('Z')) {
      console.log(`⚠️ WARNING: Received UTC time (${finalStartTime}), converting to EDT...`);
      const utcDate = new Date(finalStartTime);
      
      // Convert to EDT string
      const edtString = utcDate.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      const [datePart, timePart] = edtString.split(', ');
      const [month, day, year] = datePart.split('/');
      const [hours, minutes, seconds] = timePart.split(':');
      
      const now = new Date();
      const isEDT = now.getMonth() >= 2 && now.getMonth() < 10;
      const offset = isEDT ? '-04:00' : '-05:00';
      
      finalStartTime = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hours}:${minutes}:${seconds}${offset}`;
      console.log(`✅ Converted UTC to EDT: ${newStartTime} → ${finalStartTime}`);
    }

    console.log(`⏰ Final booking time: ${finalStartTime}`);

    const getResponse = await squareClient.bookingsApi.retrieveBooking(bookingId);
    const currentBooking = getResponse.result.booking;
    const originalSource = currentBooking.customerNote || BOOKING_SOURCES.PHONE;

    // Convert finalStartTime (EDT) to UTC for Square API
    const edtDate = new Date(finalStartTime);
    const utcTimeForSquare = edtDate.toISOString();
    
    console.log(`🔄 Sending to Square API: ${utcTimeForSquare} (${finalStartTime} EDT)`);

    // Only send writable fields to avoid "read-only field" errors
    const updateResponse = await squareClient.bookingsApi.updateBooking(
      bookingId,
      {
        booking: {
          locationId: currentBooking.locationId,
          startAt: utcTimeForSquare,  // Square expects UTC
          customerId: currentBooking.customerId,
          customerNote: `${originalSource} (Rescheduled via phone)`,
          appointmentSegments: currentBooking.appointmentSegments.map(segment => ({
            serviceVariationId: segment.serviceVariationId,
            teamMemberId: segment.teamMemberId,
            serviceVariationVersion: segment.serviceVariationVersion
          })),
          version: currentBooking.version
        }
      }
    );

    const booking = sanitizeBigInt(updateResponse.result.booking);
    const humanReadableTime = formatUTCtoEDT(booking.startAt);

    console.log(`✅ Rescheduled to ${humanReadableTime} (${booking.startAt} UTC)`);

    res.json({
      success: true,
      booking: booking,
      message: `Appointment rescheduled to ${humanReadableTime}`,
      debugInfo: {
        receivedTime: newStartTime,
        correctedTime: finalStartTime,
        sentToSquare: utcTimeForSquare,
        finalTime: humanReadableTime
      }
    });
  } catch (error) {
    console.error('❌ rescheduleBooking error:', error);
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
 * Lookup Booking by Phone - 🔥 v2.7.8: Separate active and cancelled bookings
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
    const rawBookings = sanitizeBigInt(bookingsResponse.result.bookings || []);
    
    // 🔥 v2.7.8 FIX: Separate active and cancelled bookings
    const activeBookings = [];
    const cancelledBookings = [];
    
    rawBookings.forEach(booking => {
      const formattedBooking = {
        ...booking,
        startAt_formatted: formatUTCtoEDT(booking.startAt),
        startAt_utc: booking.startAt
      };
      
      if (booking.status === 'CANCELLED_BY_SELLER' || booking.status === 'CANCELLED_BY_CUSTOMER') {
        cancelledBookings.push(formattedBooking);
      } else {
        activeBookings.push(formattedBooking);
      }
    });

    console.log(`✅ Found ${rawBookings.length} total bookings: ${activeBookings.length} active, ${cancelledBookings.length} cancelled`);

    // Create clear message
    let message = '';
    if (activeBookings.length > 0 && cancelledBookings.length > 0) {
      message = `Found ${activeBookings.length} active booking(s) and ${cancelledBookings.length} cancelled booking(s)`;
    } else if (activeBookings.length > 0) {
      message = `Found ${activeBookings.length} active booking(s)`;
    } else if (cancelledBookings.length > 0) {
      message = `Found ${cancelledBookings.length} cancelled booking(s) but no active bookings`;
    } else {
      message = 'No upcoming bookings found';
    }

    res.json({
      success: true,
      found: true,
      customer: customer,
      activeBookings: activeBookings,
      cancelledBookings: cancelledBookings,
      totalBookings: rawBookings.length,
      activeCount: activeBookings.length,
      cancelledCount: cancelledBookings.length,
      message: message
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
    version: '2.8.1 - Fixed phone number format in customer search to keep + prefix',
    sdkVersion: '43.0.2',
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
      analytics: ['GET /analytics/sources']
    },
    bookingSources: BOOKING_SOURCES,
    availableServices: Object.keys(SERVICE_MAPPINGS)
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
  console.log(`🚫 v2.4.0: Filters out already-booked time slots!`);
  console.log(`🕐 v2.4.1: lookupBooking now formats times to EDT!`);
  console.log(`➕ v2.5.0: addServicesToBooking endpoint with conflict detection`);
  console.log(`✅ v2.6.0: FIXED overlap detection - back-to-back OK, overlaps blocked!`);
  console.log(`🆕 v2.7.0: Added getCurrentDateTime endpoint + improved time matching (1-min tolerance)!`);
  console.log(`🔧 v2.7.1: Fixed rescheduleBooking read-only fields error!`);
  console.log(`🔧 v2.7.2: Fixed cancelled bookings incorrectly blocking availability!`);
  console.log(`🔧 v2.7.3: Fixed "Bookings can only be made in the future" error!`);
  console.log(`🔧 v2.7.4: Fixed invalid time range error (end_at before start_at)!`);
  console.log(`🔧 v2.7.5: Fixed past date requests (rejects 2024 dates when in 2025)!`);
  console.log(`🔧 v2.7.6: Fixed date format confusion - now uses "Thu, Oct 10, 2025" instead of "10/10/2025"!`);
  console.log(`🔧 v2.7.7: Enhanced error logging to capture detailed Square API errors!`);
  console.log(`🔧 v2.7.8: FIXED lookupBooking - now separates active and cancelled bookings!`);
  console.log(`🔥 v2.7.9: FIXED timezone handling in rescheduleBooking - auto-validates and corrects!`);
  console.log(`🔍 v2.8.0: ENHANCED error logging for customer creation - captures full Square API error details!`);
  console.log(`🔧 v2.8.1: FIXED customer search - now keeps + prefix in phone number for Square API!`);
  console.log(`\n🌐 Endpoints available (8 tools):`);
  console.log(`   POST /tools/getCurrentDateTime`);
  console.log(`   POST /tools/getAvailability`);
  console.log(`   POST /tools/createBooking`);
  console.log(`   POST /tools/addServicesToBooking`);
  console.log(`   POST /tools/rescheduleBooking`);
  console.log(`   POST /tools/cancelBooking`);
  console.log(`   POST /tools/lookupBooking`);
  console.log(`   POST /tools/generalInquiry`);
  console.log(`\n📋 Available services:`, Object.keys(SERVICE_MAPPINGS).join(', '));
});
