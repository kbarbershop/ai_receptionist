import { randomUUID } from 'crypto';
import { squareClient } from '../config/square.js';
import { LOCATION_ID, BOOKING_SOURCES, SERVICE_MAPPINGS, SERVICE_DURATIONS } from '../config/constants.js';
import { sanitizeBigInt } from '../utils/bigint.js';
import { formatUTCtoEDT, validateAndFixTimezone } from '../utils/datetime.js';

/**
 * Get service duration in milliseconds
 */
export function getServiceDuration(serviceVariationId) {
  return SERVICE_DURATIONS[serviceVariationId] || 1800000; // Default 30 min
}

/**
 * Parse and convert booking start time from EDT to UTC
 * CRITICAL FIX v2.9.1: Use native Date parser for correct timezone handling
 */
export function parseBookingTime(startTime) {
  console.log(`🕐 parseBookingTime received: ${startTime}`);
  
  // Check if time is in EDT format (ends with -04:00 or -05:00)
  if (startTime.includes('-04:00') || startTime.includes('-05:00')) {
    // Use JavaScript's built-in Date parser - it handles timezone offsets correctly
    // Input: "2025-10-14T11:00:00-04:00" (11 AM EDT)
    // Output: "2025-10-14T15:00:00.000Z" (3 PM UTC) which Square displays as 11 AM EDT
    const edtDate = new Date(startTime);
    
    if (!isNaN(edtDate.getTime())) {
      const bookingStartTime = edtDate.toISOString();
      console.log(`✅ Converted EDT to UTC:`);
      console.log(`   Input (EDT): ${startTime}`);
      console.log(`   Output (UTC): ${bookingStartTime}`);
      
      return bookingStartTime;
    }
  }
  
  // If already in UTC format or other format, use as-is
  if (startTime.endsWith('Z')) {
    console.log(`   Already UTC: ${startTime}`);
    return startTime;
  }
  
  // Handle legacy formatted object
  if (startTime.includes('human_readable') || startTime.includes('start_at_edt')) {
    try {
      const timeObj = JSON.parse(startTime);
      return timeObj.start_at_utc || timeObj.start_at;
    } catch {
      // Just use as-is if not JSON
    }
  }
  
  console.log(`⚠️  Unrecognized format, using as-is: ${startTime}`);
  return startTime;
}

/**
 * Create a new booking with one or more services
 * @param {string} customerId - Square customer ID
 * @param {string} startTime - ISO 8601 datetime in EDT format
 * @param {string|string[]} serviceVariationIds - Single ID or array of service variation IDs
 * @param {string} teamMemberId - Team member ID
 * @returns {object} Created booking with duration info
 */
export async function createBooking(customerId, startTime, serviceVariationIds, teamMemberId) {
  const bookingStartTime = parseBookingTime(startTime);
  console.log(`⏰ Booking time (UTC for Square API): ${bookingStartTime}`);
  
  // Handle both single service (backward compatible) and multiple services
  const serviceIds = Array.isArray(serviceVariationIds) ? serviceVariationIds : [serviceVariationIds];
  
  console.log(`📋 Creating booking with ${serviceIds.length} service(s):`, serviceIds);
  
  // Calculate total duration
  let totalDuration = 0;
  const appointmentSegments = serviceIds.map(serviceId => {
    const duration = getServiceDuration(serviceId);
    totalDuration += duration;
    return {
      serviceVariationId: serviceId,
      teamMemberId: teamMemberId,
      serviceVariationVersion: BigInt(Date.now())
    };
  });
  
  console.log(`⏱️  Total appointment duration: ${totalDuration / 60000} minutes (${serviceIds.length} service(s))`);
  
  const bookingPayload = {
    booking: {
      locationId: LOCATION_ID,
      startAt: bookingStartTime,
      customerId: customerId,
      customerNote: BOOKING_SOURCES.PHONE,
      appointmentSegments: appointmentSegments
    },
    idempotencyKey: randomUUID()
  };
  
  console.log(`🔧 Calling Square createBooking with UTC time: ${bookingStartTime}`);
  
  try {
    const bookingResponse = await squareClient.bookingsApi.createBooking(bookingPayload);
    const booking = sanitizeBigInt(bookingResponse.result.booking);
    console.log(`✅ Booking created: ${booking.id} with ${serviceIds.length} service(s)`);
    
    return {
      ...booking,
      duration_minutes: totalDuration / 60000,
      service_count: serviceIds.length
    };
  } catch (error) {
    console.error('❌ ========== BOOKING CREATION FAILED ==========');
    console.error('❌ Error message:', error.message);
    console.error('❌ Error statusCode:', error.statusCode);
    
    if (error.errors && Array.isArray(error.errors)) {
      console.error('❌ Square API errors:', JSON.stringify(error.errors, null, 2));
    }
    if (error.result && error.result.errors) {
      console.error('❌ Square result.errors:', JSON.stringify(error.result.errors, null, 2));
    }
    
    console.error('❌ Booking payload:', JSON.stringify({
      locationId: LOCATION_ID,
      startAt: bookingStartTime,
      customerId: customerId,
      serviceVariationIds: serviceIds,
      teamMemberId: teamMemberId
    }, null, 2));
    console.error('❌ ===============================================');
    
    throw error;
  }
}

/**
 * Retrieve a booking by ID
 */
export async function getBooking(bookingId) {
  const response = await squareClient.bookingsApi.retrieveBooking(bookingId);
  return response.result.booking;
}

/**
 * Check for booking overlaps
 */
export async function checkForOverlaps(bookingStart, bookingEnd, teamMemberId, excludeBookingId = null) {
  const checkStart = bookingStart;
  const checkEnd = new Date(bookingEnd.getTime() + (60 * 60 * 1000)); // Check 1 hour ahead
  
  console.log(`🔍 Checking for overlaps from ${checkStart.toISOString()} to ${checkEnd.toISOString()}`);
  
  const conflictResponse = await squareClient.bookingsApi.listBookings(
    undefined, undefined, undefined, teamMemberId,
    LOCATION_ID,
    checkStart.toISOString(),
    checkEnd.toISOString()
  );
  
  // Filter out cancelled bookings AND the current booking
  const potentialConflicts = (conflictResponse.result.bookings || []).filter(b => 
    b.id !== excludeBookingId && 
    b.status !== 'CANCELLED_BY_SELLER' && 
    b.status !== 'CANCELLED_BY_CUSTOMER'
  );
  
  console.log(`📋 Found ${potentialConflicts.length} active bookings to check`);
  
  // Check if any bookings would OVERLAP
  for (const booking of potentialConflicts) {
    const nextBookingStart = new Date(booking.startAt);
    
    // OVERLAP happens if next booking starts BEFORE our booking ends
    // Back-to-back is OK (nextBookingStart == bookingEnd)
    if (nextBookingStart < bookingEnd) {
      console.log(`❌ OVERLAP DETECTED!`);
      return { hasOverlap: true, conflictingBooking: booking };
    }
  }
  
  console.log(`✅ No overlaps detected`);
  return { hasOverlap: false };
}

/**
 * Add services to an existing booking
 * Square doesn't allow updating appointment segments, so we:
 * 1. Check for conflicts with the extended time
 * 2. If no conflict: Cancel old booking + Create new booking with all services
 * 3. If conflict: Return error with suggestion
 */
export async function addServicesToBooking(bookingId, serviceNames) {
  console.log(`➕ addServicesToBooking: Adding ${serviceNames} to booking ${bookingId}`);
  
  const currentBooking = await getBooking(bookingId);
  const currentTeamMemberId = currentBooking.appointmentSegments[0].teamMemberId;
  const customerId = currentBooking.customerId;
  const originalStartTime = currentBooking.startAt;
  
  // Get existing service IDs
  const existingServiceIds = currentBooking.appointmentSegments.map(seg => seg.serviceVariationId);
  console.log(`   Existing services:`, existingServiceIds);
  
  // Convert service names to variation IDs
  const newServiceIds = [];
  const invalidServices = [];
  
  for (const serviceName of serviceNames) {
    const variationId = SERVICE_MAPPINGS[serviceName];
    if (!variationId) {
      invalidServices.push(serviceName);
      continue;
    }
    newServiceIds.push(variationId);
  }
  
  if (invalidServices.length > 0) {
    throw new Error(`Invalid service names: ${invalidServices.join(', ')}. Valid names are: ${Object.keys(SERVICE_MAPPINGS).join(', ')}`);
  }
  
  console.log(`   New services to add:`, newServiceIds);
  
  // Combine all services
  const allServiceIds = [...existingServiceIds, ...newServiceIds];
  console.log(`   Combined services (${allServiceIds.length} total):`, allServiceIds);
  
  // Calculate durations
  const currentDuration = existingServiceIds.reduce((total, id) => total + getServiceDuration(id), 0);
  const additionalDuration = newServiceIds.reduce((total, id) => total + getServiceDuration(id), 0);
  const totalDuration = currentDuration + additionalDuration;
  
  const bookingStart = new Date(originalStartTime);
  const bookingEnd = new Date(bookingStart.getTime() + totalDuration);
  
  console.log(`⏱️  Current: ${currentDuration / 60000}min, Additional: ${additionalDuration / 60000}min, Total: ${totalDuration / 60000}min`);
  console.log(`   New end time: ${bookingEnd.toISOString()}`);
  
  // Check for overlaps with the extended booking time
  const { hasOverlap, conflictingBooking } = await checkForOverlaps(
    bookingStart,
    bookingEnd,
    currentTeamMemberId,
    bookingId
  );
  
  if (hasOverlap) {
    const nextBookingTime = formatUTCtoEDT(conflictingBooking.startAt);
    const currentTime = formatUTCtoEDT(originalStartTime);
    console.log(`❌ CONFLICT: Cannot add services - would overlap with appointment at ${nextBookingTime}`);
    
    return {
      success: false,
      hasConflict: true,
      message: `I cannot add these services to your ${currentTime} appointment because there's another customer scheduled at ${nextBookingTime}. The additional services would take ${additionalDuration / 60000} minutes and would overlap.`,
      currentTime: currentTime,
      nextBooking: nextBookingTime,
      additionalDuration: additionalDuration / 60000,
      suggestion: 'Would you like to book these services at a different time?'
    };
  }
  
  // No conflict - cancel old booking and create new one with all services
  console.log(`✅ No conflicts - proceeding to cancel and rebook`);
  
  try {
    // Step 1: Cancel the old booking
    console.log(`   Step 1: Cancelling old booking ${bookingId}`);
    await squareClient.bookingsApi.cancelBooking(
      bookingId,
      { bookingVersion: currentBooking.version }
    );
    console.log(`   ✅ Old booking cancelled`);
    
    // Step 2: Create new booking with all services
    console.log(`   Step 2: Creating new booking with ${allServiceIds.length} services`);
    const newBooking = await createBooking(
      customerId,
      originalStartTime,
      allServiceIds,
      currentTeamMemberId
    );
    console.log(`   ✅ New booking created: ${newBooking.id}`);
    
    // Get service names for response
    const allServiceNames = allServiceIds.map(id => {
      const serviceName = Object.keys(SERVICE_MAPPINGS).find(name => SERVICE_MAPPINGS[name] === id);
      return serviceName || 'Unknown Service';
    });
    
    return {
      success: true,
      booking: newBooking,
      oldBookingId: bookingId,
      newBookingId: newBooking.id,
      servicesAdded: serviceNames,
      allServices: allServiceNames,
      totalServices: allServiceIds.length,
      duration_minutes: totalDuration / 60000,
      message: `Successfully added ${serviceNames.join(', ')} to your appointment. Your appointment will now take ${totalDuration / 60000} minutes total for: ${allServiceNames.join(', ')}.`
    };
  } catch (error) {
    console.error(`❌ Failed to cancel and rebook:`, error);
    throw new Error(`Failed to add services: ${error.message}`);
  }
}

/**
 * Reschedule a booking
 */
export async function rescheduleBooking(bookingId, newStartTime) {
  console.log(`📅 rescheduleBooking called:`, { bookingId, newStartTime });
  
  // Get current booking first
  const currentBooking = await getBooking(bookingId);
  const teamMemberId = currentBooking.appointmentSegments[0].teamMemberId;
  
  // Calculate total duration of booking
  const totalDuration = currentBooking.appointmentSegments.reduce((total, segment) => {
    return total + getServiceDuration(segment.serviceVariationId);
  }, 0);
  
  // Validate and fix timezone
  const finalStartTime = validateAndFixTimezone(newStartTime);
  console.log(`⏰ Final booking time (EDT): ${finalStartTime}`);
  
  // Convert EDT to UTC for Square API
  const utcTimeForSquare = parseBookingTime(finalStartTime);
  const newBookingStart = new Date(utcTimeForSquare);
  const newBookingEnd = new Date(newBookingStart.getTime() + totalDuration);
  
  console.log(`🔄 New booking window (UTC): ${newBookingStart.toISOString()} to ${newBookingEnd.toISOString()}`);
  console.log(`⏱️  Duration: ${totalDuration / 60000} minutes`);
  
  // Check for overlaps with the new time
  const { hasOverlap, conflictingBooking } = await checkForOverlaps(
    newBookingStart,
    newBookingEnd,
    teamMemberId,
    bookingId // Exclude current booking from check
  );
  
  if (hasOverlap) {
    const conflictTime = formatUTCtoEDT(conflictingBooking.startAt);
    const requestedTime = formatUTCtoEDT(utcTimeForSquare);
    console.log(`❌ OVERLAP: Cannot reschedule to ${requestedTime} - conflicts with ${conflictTime}`);
    
    return {
      success: false,
      hasConflict: true,
      message: `I cannot reschedule your appointment to ${requestedTime} because there is already another customer scheduled at ${conflictTime}. Your appointment would take ${totalDuration / 60000} minutes and would overlap. Please choose a different time.`,
      requestedTime: requestedTime,
      conflictingTime: conflictTime,
      duration: totalDuration / 60000
    };
  }
  
  // No overlap - proceed with reschedule
  const originalSource = currentBooking.customerNote || BOOKING_SOURCES.PHONE;
  
  const updateResponse = await squareClient.bookingsApi.updateBooking(
    bookingId,
    {
      booking: {
        locationId: currentBooking.locationId,
        startAt: utcTimeForSquare,
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
  
  console.log(`✅ Rescheduled to ${humanReadableTime}`);
  
  return {
    success: true,
    booking: booking,
    message: `Appointment rescheduled to ${humanReadableTime}`,
    debugInfo: {
      receivedTime: newStartTime,
      correctedTime: finalStartTime,
      sentToSquare: utcTimeForSquare,
      finalTime: humanReadableTime
    }
  };
}

/**
 * Cancel a booking
 */
export async function cancelBooking(bookingId) {
  const currentBooking = await getBooking(bookingId);
  
  const cancelResponse = await squareClient.bookingsApi.cancelBooking(
    bookingId,
    {
      bookingVersion: currentBooking.version
    }
  );
  
  const booking = sanitizeBigInt(cancelResponse.result.booking);
  
  return {
    success: true,
    booking: booking,
    message: 'Appointment cancelled successfully'
  };
}

/**
 * Lookup customer bookings
 * Returns appointments from 60 days past to 60 days future
 * IMPORTANT: Square API has a 31-day limit per call, so we make multiple calls
 */
export async function lookupCustomerBookings(customerId) {
  const now = new Date();
  
  console.log(`🔍 Looking up bookings for customer ${customerId}`);
  console.log(`   Strategy: Multiple API calls (Square has 31-day limit per call)`);
  
  // Define our desired ranges
  const past60 = new Date(now);
  past60.setDate(past60.getDate() - 60);
  
  const future60 = new Date(now);
  future60.setDate(future60.getDate() + 60);
  
  // Split into multiple 30-day chunks to stay under Square's 31-day limit
  const ranges = [
    // Past: 60-30 days ago
    { start: new Date(past60), end: new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)), label: '60-30 days ago' },
    // Past: 30 days ago to now
    { start: new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)), end: new Date(now), label: '30 days ago to now' },
    // Future: now to 30 days
    { start: new Date(now), end: new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)), label: 'now to 30 days' },
    // Future: 30-60 days
    { start: new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)), end: new Date(future60), label: '30-60 days ahead' }
  ];
  
  console.log(`   Total range: ${past60.toISOString()} to ${future60.toISOString()}`);
  console.log(`   Split into ${ranges.length} API calls (each ≤30 days)`);
  
  const allBookings = [];
  
  // Make multiple API calls
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    console.log(`   Call ${i + 1}/${ranges.length}: ${range.label}`);
    console.log(`     ${range.start.toISOString()} to ${range.end.toISOString()}`);
    
    try {
      const bookingsResponse = await squareClient.bookingsApi.listBookings(
        undefined,
        undefined,
        customerId,
        undefined,
        LOCATION_ID,
        range.start.toISOString(),
        range.end.toISOString()
      );
      
      const rangeBookings = bookingsResponse.result.bookings || [];
      console.log(`     Found ${rangeBookings.length} bookings in this range`);
      
      // Add to collection (avoid duplicates by checking ID)
      rangeBookings.forEach(booking => {
        if (!allBookings.find(b => b.id === booking.id)) {
          allBookings.push(booking);
        }
      });
    } catch (error) {
      console.error(`     ⚠️ Error fetching range ${range.label}:`, error.message);
      // Continue with other ranges even if one fails
    }
  }
  
  const rawBookings = sanitizeBigInt(allBookings);
  
  // Separate active and cancelled bookings
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
  
  console.log(`✅ Total: ${rawBookings.length} bookings (${activeBookings.length} active, ${cancelledBookings.length} cancelled)`);
  
  // Create clear message
  let message = '';
  if (activeBookings.length > 0 && cancelledBookings.length > 0) {
    message = `Found ${activeBookings.length} active booking(s) and ${cancelledBookings.length} cancelled booking(s)`;
  } else if (activeBookings.length > 0) {
    message = `Found ${activeBookings.length} active booking(s)`;
  } else if (cancelledBookings.length > 0) {
    message = `Found ${cancelledBookings.length} cancelled booking(s) but no active bookings`;
  } else {
    message = 'No bookings found in the past 60 days or next 60 days';
  }
  
  return {
    activeBookings,
    cancelledBookings,
    totalBookings: rawBookings.length,
    activeCount: activeBookings.length,
    cancelledCount: cancelledBookings.length,
    message
  };
}
