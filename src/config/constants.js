// Booking source constants
export const BOOKING_SOURCES = {
  PHONE: 'Phone Booking (ElevenLabs AI)',
  WEBSITE: 'Website Booking',
  IN_STORE: 'In Store Booking',
  MANUAL: 'Manual Booking'
};

// Service name to variation ID mapping
export const SERVICE_MAPPINGS = {
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

// Service duration in milliseconds
export const SERVICE_DURATIONS = {
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

export const LOCATION_ID = process.env.SQUARE_LOCATION_ID || 'LCS4MXPZP8J3M';
export const DEFAULT_TEAM_MEMBER_ID = 'TMKzhB-WjsDff5rr';
export const TIMEZONE = 'America/New_York';
export const VERSION = '2.9.0';
