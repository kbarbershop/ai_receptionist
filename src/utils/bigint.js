/**
 * Safely convert BigInt to string
 */
export function safeBigIntToString(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return value.toString();
  return String(value);
}

/**
 * Sanitize objects containing BigInt for JSON serialization
 */
export function sanitizeBigInt(obj) {
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
}
