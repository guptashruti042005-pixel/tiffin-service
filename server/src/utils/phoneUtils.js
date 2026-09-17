/**
 * Phone number utilities for TiffinTrack
 * Normalizes phone numbers consistently for robust lookup and deduplication.
 */

/**
 * Normalizes phone numbers by stripping formatting (spaces, dashes, parentheses, dots)
 * and harmonizing country/trunk prefixes (+91, 0).
 * @param {string} raw 
 * @returns {string} Normalized phone number (digits only)
 */
export const normalizePhone = (raw) => {
  if (!raw) return '';
  let str = String(raw).trim();

  // Strip common punctuation & whitespace
  str = str.replace(/[\s\-\(\)\.\/\\]/g, '');

  // Handle +91 or 91 country code prefix for 10-digit mobile numbers
  if (str.startsWith('+91') && str.length === 13) {
    str = str.slice(3);
  } else if (str.startsWith('91') && str.length === 12) {
    str = str.slice(2);
  } else if (str.startsWith('+')) {
    str = str.slice(1);
  }

  // Handle leading zero trunk prefix (e.g., 09876543210 -> 9876543210)
  if (str.startsWith('0') && str.length === 11) {
    str = str.slice(1);
  }

  return str;
};

/**
 * Validates whether a normalized phone number is valid
 * @param {string} phone 
 * @returns {boolean}
 */
export const isValidPhone = (phone) => {
  if (!phone) return false;
  const normalized = normalizePhone(phone);
  // Valid phone should be numeric and between 7 and 15 digits
  return /^\d{7,15}$/.test(normalized);
};
