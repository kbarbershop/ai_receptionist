/**
 * Normalize phone numbers to E.164 format (+1XXXXXXXXXX)
 * For searching customers in Square API
 */
export function normalizePhoneNumber(phone) {
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
}

/**
 * Format phone number for Square createCustomer API
 * Square expects 10-digit format without country code for US numbers
 * Example: +15715266016 → 5715266016
 */
export function formatPhoneForCreation(normalizedPhone) {
  if (!normalizedPhone) return null;
  // Remove +1 prefix completely to get 10-digit number
  return normalizedPhone.replace(/^\+1/, '');
}

/**
 * Get multiple phone format variations for searching
 */
export function getPhoneSearchFormats(phone) {
  const normalized = normalizePhoneNumber(phone);
  return [
    normalized,                      // +15716995142
    normalized.replace(/^\+/, ''),   // 15716995142
    normalized.replace(/^\+1/, '')   // 5716995142
  ];
}
