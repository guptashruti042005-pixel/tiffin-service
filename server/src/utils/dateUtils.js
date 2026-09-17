/**
 * Date utility functions for TiffinTrack
 * Implements strict date-only semantics (YYYY-MM-DD) to prevent timezone and DST billing issues.
 */

/**
 * Format a Date object or string to YYYY-MM-DD
 * @param {Date|string} date 
 * @returns {string} YYYY-MM-DD
 */
export const toDateString = (date) => {
  if (!date) return '';
  if (typeof date === 'string') {
    // If already in YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      return date.trim();
    }
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parse a messy date string into standard YYYY-MM-DD format
 * Supports: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD
 * @param {string} input 
 * @returns {string|null} YYYY-MM-DD or null if invalid
 */
export const parseMessyDate = (input) => {
  if (!input) return null;
  const str = String(input).trim();
  if (!str) return null;

  // 1. ISO standard: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (isValidDateParts(year, month, day)) {
      return formatParts(year, month, day);
    }
  }

  // 2. Day-first: DD-MM-YYYY or DD/MM/YYYY
  // Notice: if first number > 12, it is definitely a day
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);

    // If p1 > 12, it must be DD-MM-YYYY
    if (p1 > 12 && p2 <= 12) {
      if (isValidDateParts(year, p2, p1)) return formatParts(year, p2, p1);
    }
    // If p2 > 12, it must be MM-DD-YYYY
    else if (p2 > 12 && p1 <= 12) {
      if (isValidDateParts(year, p1, p2)) return formatParts(year, p1, p2);
    }
    // Ambiguous (both <= 12): standard Indian/Commonwealth DD-MM-YYYY preferred
    else if (p1 <= 12 && p2 <= 12) {
      // Default to DD-MM-YYYY
      if (isValidDateParts(year, p2, p1)) return formatParts(year, p2, p1);
    }
  }

  // 3. Fallback standard Date parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = parsed.getMonth() + 1;
    const day = parsed.getDate();
    if (isValidDateParts(year, month, day)) {
      return formatParts(year, month, day);
    }
  }

  return null;
};

const isValidDateParts = (year, month, day) => {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && (d.getUTCMonth() + 1) === month && d.getUTCDate() === day;
};

const formatParts = (year, month, day) => {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/**
 * Check if a YYYY-MM-DD string is a weekday (Monday-Friday)
 * @param {string} dateStr 
 * @returns {boolean}
 */
export const isWeekday = (dateStr) => {
  if (!dateStr) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = d.getUTCDay(); // 0 = Sunday, 6 = Saturday
  return dayOfWeek >= 1 && dayOfWeek <= 5;
};

/**
 * Get all calendar dates in inclusive range [startStr, endStr]
 * @param {string} startStr YYYY-MM-DD
 * @param {string} endStr YYYY-MM-DD
 * @returns {string[]}
 */
export const getDatesInRange = (startStr, endStr) => {
  if (!startStr || !endStr || startStr > endStr) return [];
  const dates = [];
  let current = startStr;
  while (current <= endStr) {
    dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
};

/**
 * Get all weekdays (Mon-Fri) in inclusive range [startStr, endStr]
 * @param {string} startStr YYYY-MM-DD
 * @param {string} endStr YYYY-MM-DD
 * @returns {string[]}
 */
export const getWeekdaysInRange = (startStr, endStr) => {
  return getDatesInRange(startStr, endStr).filter(isWeekday);
};

/**
 * Count weekdays (Mon-Fri) in inclusive range [startStr, endStr]
 * @param {string} startStr 
 * @param {string} endStr 
 * @returns {number}
 */
export const countWeekdays = (startStr, endStr) => {
  return getWeekdaysInRange(startStr, endStr).length;
};

/**
 * Add N calendar days to a YYYY-MM-DD string
 * @param {string} dateStr 
 * @param {number} days 
 * @returns {string}
 */
export const addDays = (dateStr, days) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dt = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
};
