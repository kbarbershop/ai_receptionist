import { Client } from 'square/legacy';

// Initialize Square client using legacy API (compatible with SDK v40+)
export const squareClient = new Client({
  bearerAuthCredentials: {
    accessToken: process.env.SQUARE_ACCESS_TOKEN
  },
  environment: 'production'
});
