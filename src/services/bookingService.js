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
 * Parse and convert booking start time
 */
export function parseBookingTime(startTime) {
  let bookingStartTime = startTime;
  
  // Check if time is in EDT format (ends with -04:00)
  if (startTime.includes('-04:00')) {
    const edtDate = new Date(startTime);
    bookingStartTime = edtDate.toISOString();
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
  
  return bookingStartTime;
}

/**
 * Create a new booking
 */
export async function createBooking(customerId, startTime, serviceVariationId, teamMemberId) {
  const bookingStartTime = parseBookingTime(startTime);
  console.log(`⏰ Booking time (UTC): ${bookingStartTime}`);
  
  const bookingPayload = {
    booking: {
      locationId: LOCATION_ID,
      startAt: bookingStartTime,
      customerId: customerId,
      customerNote: BOOKING_SOURCES.PHONE,
      appointmentSegments: [{
        serviceVariationId: serviceVariationId,
        teamMemberId: teamMemberId,
        serviceVariationVersion: BigInt(Date.now())
      }]
    },
    idempotencyKey: randomUUID()
  };
  
  console.log(`🔧 Calling Square createBooking`);
  
  try {
    const bookingResponse = await squareClient.bookingsApi.createBooking(bookingPayload);
    const booking = sanitizeBigInt(bookingResponse.result.booking);
    console.log(`✅ Booking created: ${booking.id}`);
    return booking;
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
      serviceVariationId: serviceVariationId,
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
 */
export async function addServicesToBooking(bookingId, serviceNames) {
  const currentBooking = await getBooking(bookingId);
  const currentTeamMemberId = currentBooking.appointmentSegments[0].teamMemberId;
  
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
    throw new Error(`Invalid service names: ${invalidServices.join(', ')}. Valid names are: ${Object.keys(SERVICE_MAPPINGS).join(', ')}`);
  }
  
  // Calculate durations
  const currentDuration = getServiceDuration(currentBooking.appointmentSegments[0].serviceVariationId);
  const additionalDuration = newSegments.reduce((total, seg) => total + getServiceDuration(seg.serviceVariationId), 0);
  const totalDuration = currentDuration + additionalDuration;
  
  const bookingStart = new Date(currentBooking.startAt);
  const bookingEnd = new Date(bookingStart.getTime() + totalDuration);
  
  console.log(`⏱️  Current: ${currentDuration / 60000}min, Additional: ${additionalDuration / 60000}min, Total: ${totalDuration / 60000}min`);
  
  // Check for overlaps
  const { hasOverlap, conflictingBooking } = await checkForOverlaps(
    new Date(bookingStart.getTime() + currentDuration),
    bookingEnd,
    currentTeamMemberId,
    bookingId
  );
  
  if (hasOverlap) {
    const nextBookingTime = formatUTCtoEDT(conflictingBooking.startAt);
    return {
      success: false,
      hasConflict: true,
      message: `I cannot add these services to your ${formatUTCtoEDT(currentBooking.startAt)} appointment because we have another customer scheduled at ${nextBookingTime}. The additional services would take ${additionalDuration / 60000} minutes and would overlap with the next appointment.`,
      nextBooking: nextBookingTime,
      additionalDuration: additionalDuration / 60000
    };
  }
  
  // No overlap - update booking
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
  
  return {
    success: true,
    booking: updatedBooking,
    servicesAdded: serviceNames,
    totalServices: allSegments.length,
    message: `Successfully added ${serviceNames.join(', ')} to your appointment. Your appointment will now take approximately ${totalDuration / 60000} minutes.`
  };
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
  console.log(`⏰ Final booking time: ${finalStartTime}`);
  
  // Convert to UTC for Square API
  const edtDate = new Date(finalStartTime);
  const utcTimeForSquare = edtDate.toISOString();
  const newBookingStart = new Date(utcTimeForSquare);
  const newBookingEnd = new Date(newBookingStart.getTime() + totalDuration);
  
  console.log(`🔄 New booking window: ${newBookingStart.toISOString()} to ${newBookingEnd.toISOString()}`);
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
 */
export async function lookupCustomerBookings(customerId) {
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
  
  const rawBookings = sanitizeBigInt(bookingsResponse.result.bookings || []);
  
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
  
  return {
    activeBookings,
    cancelledBookings,
    totalBookings: rawBookings.length,
    activeCount: activeBookings.length,
    cancelledCount: cancelledBookings.length,
    message
  };
}
