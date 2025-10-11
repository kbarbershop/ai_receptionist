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
 * 🔥 v2.8.10 FIX: Fixed syntax error from duplicate const declaration
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

    // Normalize phone to +15716995142 format (E.164)
    const normalizedPhone = normalizePhoneNumber(customerPhone);
    console.log(`📞 Phone normalization: "${customerPhone}" → "${normalizedPhone}"`);

    // Find or create customer
    let customerId;
    let isNewCustomer = false;
    
    try {
      // Search for customer with + prefix (E.164 format)
      console.log(`🔍 Searching for customer with phone: ${normalizedPhone}`);
      
      let searchResponse = await squareClient.customersApi.searchCustomers({
        query: {
          filter: {
            phoneNumber: {
              exact: normalizedPhone  // +15716995142
            }
          }
        }
      });
      
      console.log(`📋 Search response:`, {
        customersFound: searchResponse.result.customers?.length || 0
      });
      
      if (searchResponse.result.customers && searchResponse.result.customers.length > 0) {
        customerId = searchResponse.result.customers[0].id;
        console.log(`✅ Found existing customer: ${customerId} with phone: ${normalizedPhone}`);
      } else {
        // Customer not found, create new
        console.log(`➕ Customer not found, creating new customer with phone: ${normalizedPhone}`);
        const nameParts = customerName.split(' ');
        
        // 🔥 v2.8.10 FIX: Remove +1 prefix leaving 10 digits for Square createCustomer API
        const phoneForCreation = normalizedPhone.replace(/^\+1/, '');  // Remove +1, keep just 5715276016
        console.log(`🔧 Using phone for creation: ${phoneForCreation}`);
        
        const customerData = {
          idempotencyKey: randomUUID(),
          customer: {
            given_name: nameParts[0],                    // ✅ snake_case
            family_name: nameParts.slice(1).join(' ') || '',  // ✅ snake_case
            phone_number: phoneForCreation,  // ✅ snake_case (10 digits, no +1)
            note: `First booking: ${BOOKING_SOURCES.PHONE} on ${new Date().toLocaleDateString()}`
          }
        };
        
        // Only add email if provided - use snake_case
        if (customerEmail) {
          customerData.customer.email_address = customerEmail;  // ✅ snake_case
        }
        
        console.log(`📝 Creating customer with data:`, {
          phone_number: phoneForCreation,   // snake_case
          given_name: nameParts[0],         // snake_case
          family_name: nameParts.slice(1).join(' ') || '',  // snake_case
          email_address: customerEmail || 'not provided'     // snake_case
        });
        
        try {
          const createResponse = await squareClient.customersApi.createCustomer(customerData);
          customerId = createResponse.result.customer.id;
          isNewCustomer = true;
          console.log(`✅ Created new customer: ${customerId}`);
        } catch (createError) {
          // 🔥 ENHANCED: Log creation error details
          console.error('❌ Customer creation failed:', {
            message: createError.message,
            statusCode: createError.statusCode,
            phone: phoneForCreation,
            name: customerName
          });
          
          if (createError.errors && Array.isArray(createError.errors)) {
            console.error('❌ Square API creation errors:', JSON.stringify(createError.errors, null, 2));
          }
          if (createError.result && createError.result.errors) {
            console.error('❌ Square result.errors:', JSON.stringify(createError.result.errors, null, 2));
          }
          
          throw createError;
        }
      }
    } catch (error) {
      console.error('❌ Customer find/create error:', {
        message: error.message,
        statusCode: error.statusCode,
        phone: normalizedPhone,
        name: customerName
      });
      
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

    // 🔥 v2.8.8: Enhanced logging for createBooking call
    const bookingPayload = {
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
    };

    console.log(`🔧 Calling Square createBooking with:`, {
      locationId: LOCATION_ID,
      startAt: bookingStartTime,
      customerId: customerId,
      serviceVariationId: serviceVariationId,
      teamMemberId: finalTeamMemberId
    });

    // Create booking
    let bookingResponse;
    try {
      bookingResponse = await squareClient.bookingsApi.createBooking(bookingPayload);
    } catch (bookingError) {
      // 🔥 v2.8.8: CRITICAL - Capture booking creation errors
      console.error('❌ ========== BOOKING CREATION FAILED ==========');
      console.error('❌ Error message:', bookingError.message);
      console.error('❌ Error statusCode:', bookingError.statusCode);
      console.error('❌ Error stack:', bookingError.stack);
      
      if (bookingError.errors && Array.isArray(bookingError.errors)) {
        console.error('❌ Square API booking errors:', JSON.stringify(bookingError.errors, null, 2));
      }
      if (bookingError.result && bookingError.result.errors) {
        console.error('❌ Square result.errors:', JSON.stringify(bookingError.result.errors, null, 2));
      }
      
      console.error('❌ Booking payload that failed:', JSON.stringify({
        locationId: LOCATION_ID,
        startAt: bookingStartTime,
        customerId: customerId,
        serviceVariationId: serviceVariationId,
        teamMemberId: finalTeamMemberId,
        customerPhone: normalizedPhone
      }, null, 2));
      console.error('❌ ===============================================');
      
      throw bookingError;
    }

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
    // 🔥 v2.8.8: Final catch-all error logging
    console.error('❌ ========== CREATEBOOKING TOP-LEVEL ERROR ==========');
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error('❌ ====================================================');
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.errors || []
    });
  }
});

// ... rest of file continues with other endpoints unchanged ...
