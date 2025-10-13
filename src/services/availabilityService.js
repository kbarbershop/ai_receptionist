import { squareClient } from '../config/square.js';
import { LOCATION_ID } from '../config/constants.js';
import { sanitizeBigInt } from '../utils/bigint.js';
import { formatTimeSlot } from '../utils/datetime.js';

// Default service variation ID for Regular Haircut
const DEFAULT_SERVICE_VARIATION_ID = '7XPUHGDLY4N3H2OWTHMIABKF';

/**
 * Parse date/time input and determine search window
 */
export function parseSearchWindow(startDate, datetime) {
  let requestedTime = null;
  let isDateOnly = false;
  const timeInput = startDate || datetime;
  
  if (timeInput) {
    // If startDate is YYYY-MM-DD format (date only, no time)
    if (startDate && startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      isDateOnly = true;
      console.log(`📅 Requested date only: ${startDate}`);
    } else if (timeInput) {
      requestedTime = new Date(timeInput);
      console.log(`📅 Requested specific time: ${requestedTime.toISOString()}`);
    }
  }
  
  // Set search window
  let startAt, endAt;
  
  if (isDateOnly && startDate) {
    const now = new Date();
    const requestedDate = new Date(startDate + 'T00:00:00-04:00');
    const endOfRequestedDate = new Date(startDate + 'T23:59:59-04:00');
    
    // If the ENTIRE requested date is in the past, reject it
    if (endOfRequestedDate < now) {
      console.log(`⛔ Requested date ${startDate} is completely in the past`);
      return { isPastDate: true };
    }
    
    // Use the LATER of midnight OR current time
    startAt = now > requestedDate ? now : requestedDate;
    endAt = endOfRequestedDate;
    
    if (now > requestedDate) {
      console.log(`⏰ Adjusted start time from midnight to now`);
    }
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
  
  // Validate time range
  if (startAt >= endAt) {
    console.log(`⚠️ Invalid time range: start >= end`);
    return { isInvalidRange: true };
  }
  
  return { startAt, endAt, requestedTime, isDateOnly };
}

/**
 * Get active bookings (excludes cancelled bookings)
 */
export async function getActiveBookings(startAt, endAt, locationId = LOCATION_ID) {
  const bookingsResponse = await squareClient.bookingsApi.listBookings(
    undefined,
    undefined,
    undefined,
    undefined,
    locationId,
    startAt.toISOString(),
    endAt.toISOString()
  );
  
  const existingBookings = bookingsResponse.result.bookings || [];
  
  // Only consider ACTIVE bookings (not cancelled)
  const activeBookings = existingBookings.filter(b => 
    b.status !== 'CANCELLED_BY_SELLER' && 
    b.status !== 'CANCELLED_BY_CUSTOMER'
  );
  
  console.log(`📋 Found ${existingBookings.length} total (${activeBookings.length} active, ${existingBookings.length - activeBookings.length} cancelled)`);
  
  return activeBookings;
}

/**
 * Search for available time slots
 * FIX v2.8.15: Add default serviceVariationId if not provided
 */
export async function searchAvailableSlots(startAt, endAt, serviceVariationId, teamMemberId = null) {
  // Use default Regular Haircut service if not provided
  const finalServiceId = serviceVariationId || DEFAULT_SERVICE_VARIATION_ID;
  
  if (!serviceVariationId) {
    console.log(`⚠️ No serviceVariationId provided, using default: ${DEFAULT_SERVICE_VARIATION_ID} (Regular Haircut)`);
  }
  
  const segmentFilter = {
    serviceVariationId: finalServiceId
  };
  
  if (teamMemberId) {
    segmentFilter.teamMemberIdFilter = { any: [teamMemberId] };
  } else {
    segmentFilter.teamMemberIdFilter = { any: [] };
  }
  
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
  
  console.log(`🔧 Calling Square searchAvailability with serviceId: ${finalServiceId}`);
  const response = await squareClient.bookingsApi.searchAvailability(apiParams);
  
  const rawSlots = sanitizeBigInt(response.result.availabilities || []);
  console.log(`✅ Found ${rawSlots.length} raw slots from Square API`);
  
  return rawSlots;
}

/**
 * Filter out already-booked time slots
 */
export function filterBookedSlots(rawSlots, activeBookings) {
  const bookedTimes = new Set(activeBookings.map(b => b.startAt));
  
  if (bookedTimes.size > 0) {
    console.log(`🚫 Booked times:`, Array.from(bookedTimes));
  }
  
  const availableSlots = rawSlots.filter(slot => {
    const slotTime = slot.start_at || slot.startAt;
    return !bookedTimes.has(slotTime);
  });
  
  console.log(`✅ After filtering: ${availableSlots.length} truly available slots`);
  return availableSlots;
}

/**
 * Find exact time match within 1-minute tolerance
 */
export function findExactMatch(formattedSlots, requestedTime) {
  if (!requestedTime || isNaN(requestedTime.getTime())) {
    return null;
  }
  
  const requestedTimeMs = requestedTime.getTime();
  console.log(`🔍 Looking for time match within 1 minute of: ${requestedTime.toISOString()}`);
  
  const exactMatch = formattedSlots.find(slot => {
    const slotTimeMs = new Date(slot.start_at_utc).getTime();
    const timeDiff = Math.abs(slotTimeMs - requestedTimeMs);
    return timeDiff < 60000; // Within 1 minute
  });
  
  if (exactMatch) {
    console.log(`✅ TIME MATCH FOUND: ${exactMatch.human_readable}`);
  }
  
  return exactMatch;
}

/**
 * Find closest alternative times
 */
export function findClosestAlternatives(formattedSlots, requestedTime, count = 5) {
  const requestedTimeMs = requestedTime.getTime();
  
  return formattedSlots
    .map(slot => ({
      ...slot,
      timeDiff: Math.abs(new Date(slot.start_at_utc).getTime() - requestedTimeMs)
    }))
    .sort((a, b) => a.timeDiff - b.timeDiff)
    .slice(0, count)
    .map(({ timeDiff, ...slot }) => slot);
}

/**
 * Get available time slots (main function)
 */
export async function getAvailability(startDate, datetime, serviceVariationId, teamMemberId = null) {
  // Parse search window
  const windowResult = parseSearchWindow(startDate, datetime);
  
  if (windowResult.isPastDate) {
    return {
      success: true,
      availableSlots: [],
      totalCount: 0,
      message: 'That date has already passed. Please choose a future date.'
    };
  }
  
  if (windowResult.isInvalidRange) {
    return {
      success: true,
      availableSlots: [],
      totalCount: 0,
      message: 'No available times - the requested time is outside business hours'
    };
  }
  
  const { startAt, endAt, requestedTime, isDateOnly } = windowResult;
  
  // Search for raw slots
  const rawSlots = await searchAvailableSlots(startAt, endAt, serviceVariationId, teamMemberId);
  
  // Get active bookings
  const activeBookings = await getActiveBookings(startAt, endAt);
  
  // Filter out booked slots
  const availableSlots = filterBookedSlots(rawSlots, activeBookings);
  const formattedSlots = availableSlots.map(formatTimeSlot);
  
  // Check for exact match
  if (requestedTime && !isDateOnly) {
    const exactMatch = findExactMatch(formattedSlots, requestedTime);
    
    if (exactMatch) {
      return {
        success: true,
        isAvailable: true,
        requestedTime: requestedTime.toISOString(),
        requestedTimeFormatted: exactMatch.human_readable,
        slot: exactMatch,
        message: `Yes, ${exactMatch.human_readable} is available`
      };
    } else {
      const alternatives = findClosestAlternatives(formattedSlots, requestedTime);
      const altTimes = alternatives.map(a => a.human_readable).join(', ');
      
      return {
        success: true,
        isAvailable: false,
        requestedTime: requestedTime.toISOString(),
        closestAlternatives: alternatives,
        message: `That time is not available. The closest available times are: ${altTimes}`
      };
    }
  }
  
  // Return all available slots
  if (formattedSlots.length > 0) {
    const firstTime = formattedSlots[0].human_readable;
    const lastTime = formattedSlots[formattedSlots.length - 1].human_readable;
    
    return {
      success: true,
      availableSlots: formattedSlots,
      totalCount: formattedSlots.length,
      firstAvailable: firstTime,
      lastAvailable: lastTime,
      message: `We have ${formattedSlots.length} available times from ${firstTime} to ${lastTime}`
    };
  } else {
    return {
      success: true,
      availableSlots: [],
      totalCount: 0,
      message: 'No available times found'
    };
  }
}
