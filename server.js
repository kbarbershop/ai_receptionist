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