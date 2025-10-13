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
 * FIX v2.9.8: Enhanced pagination cursor debugging
 * FIX v2.9.7: Separate active, completed, and cancelled bookings
 * 
 * Returns appointments from 60 days past to 60 days future
 * Square API has a 31-day limit per call, so we make multiple calls
 * Added pagination support to handle cursor and retrieve all pages
 * 
 * THREE CATEGORIES:
 * - Active: Future appointments (primary for AI agent)
 * - Completed: Past appointments (available on request)
 * - Cancelled: Hidden from AI agent entirely
 */
export async function lookupCustomerBookings(customerId) {
  const now = new Date();
  
  console.log(`🔍 Looking up bookings for customer ${customerId}`);
  console.log(`   Current time: ${now.toISOString()}`);
  console.log(`   Strategy: FUTURE-FIRST search with pagination (Square has 31-day limit per call)`);
  
  // Define time boundaries
  const past60 = new Date(now);
  past60.setDate(past60.getDate() - 60);
  
  const future60 = new Date(now);
  future60.setDate(future60.getDate() + 60);
  
  // CRITICAL FIX: Start "now" range 1 hour earlier to catch boundary appointments
  const nowMinusBuffer = new Date(now.getTime() - (60 * 60 * 1000)); // 1 hour buffer
  
  // PRIORITY ORDER: Search FUTURE first (for cancellations/reschedules)
  const ranges = [
    // 1. TODAY/TOMORROW: Now (minus 1hr buffer) to +7 days (MOST IMPORTANT - catches today/tomorrow)
    { 
      start: nowMinusBuffer,
      end: new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)), 
      label: 'NOW to +7 days (TODAY/TOMORROW priority)',
      priority: 'HIGH'
    },
    // 2. NEAR FUTURE: +7 to +30 days
    { 
      start: new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)),
      end: new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)), 
      label: '+7 to +30 days',
      priority: 'MEDIUM'
    },
    // 3. FAR FUTURE: +30 to +60 days
    { 
      start: new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)),
      end: future60, 
      label: '+30 to +60 days',
      priority: 'MEDIUM'
    },
    // 4. RECENT PAST: 30 days ago to now (for reference)
    { 
      start: new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)),
      end: now, 
      label: '30 days ago to now',
      priority: 'LOW'
    },
    // 5. OLD PAST: 60-31 days ago (rarely needed)
    { 
      start: past60,
      end: new Date(now.getTime() - (31 * 24 * 60 * 60 * 1000)), 
      label: '60-31 days ago',
      priority: 'LOW'
    }
  ];
  
  console.log(`   Total range: ${past60.toISOString()} to ${future60.toISOString()}`);
  console.log(`   Searching ${ranges.length} ranges in FUTURE-FIRST priority order`);
  
  const allBookings = [];
  
  // Make multiple API calls with pagination support
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    console.log(`\n   📍 Range ${i + 1}/${ranges.length}: ${range.label} [${range.priority} priority]`);
    console.log(`      ${range.start.toISOString()} to ${range.end.toISOString()}`);
    
    let cursor = undefined;
    let pageCount = 0;
    const maxPages = 10; // Prevent infinite loops
    
    try {
      // FIX v2.9.8: Enhanced pagination loop with detailed cursor debugging
      do {
        pageCount++;
        console.log(`      📄 Page ${pageCount}${cursor ? ' (using cursor: ' + cursor.substring(0, 30) + '...)' : ' (initial request)'}`);
        
        const bookingsResponse = await squareClient.bookingsApi.listBookings(
          cursor,
          undefined,
          customerId,
          undefined,
          LOCATION_ID,
          range.start.toISOString(),
          range.end.toISOString()
        );
        
        const rangeBookings = bookingsResponse.result.bookings || [];
        console.log(`         📦 Found ${rangeBookings.length} bookings on this page`);
        
        // Log booking details for debugging
        rangeBookings.forEach(booking => {
          const status = booking.status;
          const isCancelled = status === 'CANCELLED_BY_SELLER' || status === 'CANCELLED_BY_CUSTOMER';
          const bookingTime = new Date(booking.startAt);
          const isFuture = bookingTime > now;
          console.log(`         - ${booking.id}: ${booking.startAt} [${status}]${isFuture ? ' 🔴 FUTURE' : ' 🟢 PAST'}${isCancelled ? ' ⚫ CANCELLED' : ''}`);
        });
        
        // Add to collection (avoid duplicates by checking ID)
        rangeBookings.forEach(booking => {
          if (!allBookings.find(b => b.id === booking.id)) {
            allBookings.push(booking);
          }
        });
        
        // FIX v2.9.8: Enhanced cursor debugging
        const previousCursor = cursor;
        cursor = bookingsResponse.result.cursor;
        
        // Log cursor status for debugging
        if (cursor) {
          console.log(`         ✅ Got cursor for next page (continuing pagination)`);
          console.log(`            Cursor: ${cursor.substring(0, 50)}...`);
        } else {
          console.log(`         ✅ No more pages for this range (cursor is ${cursor === null ? 'null' : 'undefined'})`);
        }
        
        // Safety check to prevent infinite loops
        if (pageCount >= maxPages) {
          console.log(`      ⚠️  Reached max pages (${maxPages}) for this range, stopping pagination`);
          break;
        }
        
      } while (cursor); // Continue while cursor exists
      
    } catch (error) {
      console.error(`      ⚠️  Error fetching range ${range.label}:`, error.message);
      // Continue with other ranges even if one fails
    }
  }
  
  const rawBookings = sanitizeBigInt(allBookings);
  
  // FIX v2.9.7: Separate into THREE categories
  const activeBookings = [];      // Future appointments
  const completedBookings = [];   // Past completed appointments
  const cancelledBookings = [];   // Cancelled (hidden from AI)
  
  rawBookings.forEach(booking => {
    const bookingTime = new Date(booking.startAt);
    const isFuture = bookingTime > now;
    const isCancelled = booking.status === 'CANCELLED_BY_SELLER' || booking.status === 'CANCELLED_BY_CUSTOMER';
    
    const formattedBooking = {
      ...booking,
      startAt_formatted: formatUTCtoEDT(booking.startAt),
      startAt_utc: booking.startAt
    };
    
    if (isCancelled) {
      cancelledBookings.push(formattedBooking);  // Hidden from AI
    } else if (isFuture) {
      activeBookings.push(formattedBooking);     // PRIMARY - shown first
    } else {
      completedBookings.push(formattedBooking);  // Available on request
    }
  });
  
  console.log(`\n✅ FINAL RESULTS: ${rawBookings.length} total bookings`);
  console.log(`   - ${activeBookings.length} ACTIVE (future) bookings`);
  console.log(`   - ${completedBookings.length} COMPLETED (past) bookings`);
  console.log(`   - ${cancelledBookings.length} CANCELLED bookings (hidden from AI)`);
  
  // Log active bookings for easy debugging
  if (activeBookings.length > 0) {
    console.log(`\n   📅 Active appointments (FUTURE):`);
    activeBookings.forEach(booking => {
      console.log(`      - ${booking.id}: ${booking.startAt_formatted}`);
    });
  }
  
  // Create clear message focused on ACTIVE bookings
  let message = '';
  if (activeBookings.length > 0) {
    message = `Found ${activeBookings.length} active booking(s)`;
  } else if (completedBookings.length > 0) {
    message = `No active bookings. Found ${completedBookings.length} past completed appointment(s).`;
  } else {
    message = 'No active or completed bookings found';
  }
  
  return {
    activeBookings,
    completedBookings,
    cancelledBookings,  // Still returned but will be filtered out in toolsRoutes
    totalBookings: rawBookings.length,
    activeCount: activeBookings.length,
    completedCount: completedBookings.length,
    cancelledCount: cancelledBookings.length,
    message
  };
}
