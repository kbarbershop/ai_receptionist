import { TIMEZONE } from '../config/constants.js';

/**
 * Get current date/time in EDT
 */
export function getCurrentEDT() {
  const now = new Date();
  const edtString = now.toLocaleString('en-US', {
    timeZone: TIMEZONE,
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
}

/**
 * Format UTC time to EDT human-readable format with explicit month names
 */
export function formatUTCtoEDT(utcTimeString) {
  if (!utcTimeString) return null;
  
  try {
    const utcDate = new Date(utcTimeString);
    
    if (isNaN(utcDate.getTime())) {
      console.error('❌ Invalid date:', utcTimeString);
      return utcTimeString;
    }
    
    // Convert to EDT with explicit month name and weekday
    const formatted = utcDate.toLocaleString('en-US', {
      timeZone: TIMEZONE,
      weekday: 'short',
      month: 'short',
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
}

/**
 * Format time slot for ElevenLabs with both snake_case and camelCase support
 */
export function formatTimeSlot(slot) {
  try {
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
    
    const edtString = utcDate.toLocaleString('en-US', {
      timeZone: TIMEZONE,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    const [datePart, timePart] = edtString.split(', ');
    const [month, day, year] = datePart.split('/');
    const [hours, minutes, seconds] = timePart.split(':');
    
    const edtISOString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hours}:${minutes}:${seconds}-04:00`;
    
    const hour24 = parseInt(hours, 10);
    const period = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 || 12;
    const minuteStr = minutes.toString().padStart(2, '0');
    
    return {
      ...slot,
      start_at_utc: startAtField,
      start_at_edt: edtISOString,
      human_readable: `${hour12}:${minuteStr} ${period}`,
      time_24h: `${hours}:${minuteStr}`
    };
  } catch (error) {
    console.error('❌ Error formatting time slot:', error, slot);
    return slot;
  }
}

/**
 * Validate and fix timezone in datetime string
 */
export function validateAndFixTimezone(timeString) {
  let finalTime = timeString;
  
  // Check if timezone offset is missing
  if (!timeString.includes('-04:00') && !timeString.includes('-05:00') && !timeString.includes('Z')) {
    console.log(`⚠️ WARNING: Missing timezone offset: ${timeString}`);
    
    const dateObj = new Date(timeString);
    const now = new Date();
    const isEDT = now.getMonth() >= 2 && now.getMonth() < 10;
    const offset = isEDT ? '-04:00' : '-05:00';
    
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');
    
    finalTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offset}`;
    console.log(`✅ Fixed timezone: ${timeString} → ${finalTime}`);
  }
  
  // Convert UTC to EDT if needed
  if (finalTime.endsWith('Z')) {
    console.log(`⚠️ WARNING: Received UTC time, converting to EDT...`);
    const utcDate = new Date(finalTime);
    
    const edtString = utcDate.toLocaleString('en-US', {
      timeZone: TIMEZONE,
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
    
    finalTime = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hours}:${minutes}:${seconds}${offset}`;
    console.log(`✅ Converted UTC to EDT: ${timeString} → ${finalTime}`);
  }
  
  return finalTime;
}
