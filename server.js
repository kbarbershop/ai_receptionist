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

// Service mappings and helper functions remain the same...
// (truncated for brevity - rest of file continues)