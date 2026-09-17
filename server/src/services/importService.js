import Customer from '../models/Customer.js';
import Subscription from '../models/Subscription.js';
import { normalizePhone, isValidPhone } from '../utils/phoneUtils.js';
import { parseMessyDate } from '../utils/dateUtils.js';

/**
 * Service to process messy customer import batches.
 * 
 * Deterministic Rules:
 * 1. Name: Must be non-empty string.
 * 2. Phone: Must normalize to 7-15 digits.
 * 3. Dates: Supports YYYY-MM-DD, DD-MM-YYYY, MM/DD/YYYY, etc.
 * 4. Deduplication: If a phone number already exists in DB or was processed earlier in the batch:
 *    - If new valid subscription fields are provided, attach subscription to the existing customer and count as "deduped".
 *    - If no new subscription or identical subscription, count row as "deduped".
 * 5. Rejections: Any row with missing name, invalid phone, unparseable dates, or non-positive price is rejected with row index and reason.
 * 
 * @param {Array<Object>} rows 
 * @returns {Promise<{ imported: number, deduped: number, rejected: number, errors: Array<{ row: number, reason: string }> }>}
 */
export const processCustomerImport = async (rows = []) => {
  let imported = 0;
  let deduped = 0;
  let rejected = 0;
  const errors = [];

  if (!Array.isArray(rows)) {
    return {
      imported: 0,
      deduped: 0,
      rejected: 1,
      errors: [{ row: 0, reason: 'Payload must be an array of customer records' }]
    };
  }

  // Cache to track seen phones within this batch
  const batchPhoneMap = new Map();

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 1;
    const row = rows[i] || {};

    // 1. Validate and clean Name
    const rawName = row.name || row.customerName || row.Customer || '';
    const name = String(rawName).trim();
    if (!name) {
      rejected++;
      errors.push({ row: rowNumber, reason: 'Missing required field: name' });
      continue;
    }

    // 2. Validate and clean Phone
    const rawPhone = row.phone || row.phoneNumber || row.Phone || '';
    const normalizedPhone = normalizePhone(rawPhone);
    if (!isValidPhone(normalizedPhone)) {
      rejected++;
      errors.push({ row: rowNumber, reason: `Invalid phone number: "${rawPhone}"` });
      continue;
    }

    // 3. Clean optional fields
    const email = (row.email || row.Email || '').trim();
    const address = (row.address || row.Address || '').trim();

    // 4. Validate Subscription fields if present
    const rawCycleStart = row.cycleStart || row.startDate || row.start;
    const rawCycleEnd = row.cycleEnd || row.endDate || row.end;
    let cycleStart = null;
    let cycleEnd = null;

    if (rawCycleStart || rawCycleEnd) {
      cycleStart = parseMessyDate(rawCycleStart);
      cycleEnd = parseMessyDate(rawCycleEnd);

      if (!cycleStart || !cycleEnd) {
        rejected++;
        errors.push({
          row: rowNumber,
          reason: `Invalid or ambiguous date format for cycleStart (${rawCycleStart}) or cycleEnd (${rawCycleEnd})`
        });
        continue;
      }

      if (cycleStart > cycleEnd) {
        rejected++;
        errors.push({
          row: rowNumber,
          reason: `cycleStart (${cycleStart}) must be before or equal to cycleEnd (${cycleEnd})`
        });
        continue;
      }
    }

    const rawPrice = row.monthlyPrice || row.price || row.amount;
    let monthlyPrice = null;
    if (rawPrice !== undefined && rawPrice !== null && rawPrice !== '') {
      monthlyPrice = Number(rawPrice);
      if (isNaN(monthlyPrice) || monthlyPrice <= 0) {
        rejected++;
        errors.push({
          row: rowNumber,
          reason: `monthlyPrice must be a positive number: "${rawPrice}"`
        });
        continue;
      }
    }

    const planName = (row.planName || row.plan || 'Standard Lunch Plan').trim();

    try {
      // 5. Deduplication check: in batch or existing in database
      let customer = batchPhoneMap.get(normalizedPhone);
      let isExisting = Boolean(customer);

      if (!customer) {
        customer = await Customer.findOne({ phone: normalizedPhone });
        if (customer) {
          isExisting = true;
          batchPhoneMap.set(normalizedPhone, customer);
        }
      }

      if (isExisting) {
        // Customer already exists -> deterministic dedupe
        deduped++;
        // If row includes new subscription, add it
        if (cycleStart && cycleEnd && monthlyPrice) {
          const existingSub = await Subscription.findOne({
            customerId: customer._id,
            cycleStart,
            cycleEnd
          });
          if (!existingSub) {
            await Subscription.create({
              customerId: customer._id,
              planName,
              monthlyPrice,
              cycleStart,
              cycleEnd,
              status: 'active',
              ownershipSegments: [
                {
                  customerId: customer._id,
                  startDate: cycleStart,
                  endDate: cycleEnd
                }
              ]
            });
          }
        }
      } else {
        // New customer -> insert
        const newCustomer = await Customer.create({
          name,
          phone: normalizedPhone,
          email,
          address
        });
        batchPhoneMap.set(normalizedPhone, newCustomer);

        if (cycleStart && cycleEnd && monthlyPrice) {
          await Subscription.create({
            customerId: newCustomer._id,
            planName,
            monthlyPrice,
            cycleStart,
            cycleEnd,
            status: 'active',
            ownershipSegments: [
              {
                customerId: newCustomer._id,
                startDate: cycleStart,
                endDate: cycleEnd
              }
            ]
          });
        }
        imported++;
      }
    } catch (err) {
      if (err.code === 11000) {
        // Mongo duplicate key error
        deduped++;
      } else {
        rejected++;
        errors.push({ row: rowNumber, reason: `Database error: ${err.message}` });
      }
    }
  }

  return {
    imported,
    deduped,
    rejected,
    errors
  };
};
