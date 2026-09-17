import Customer from '../models/Customer.js';
import Subscription from '../models/Subscription.js';
import PausePeriod from '../models/PausePeriod.js';
import { normalizePhone, isValidPhone } from '../utils/phoneUtils.js';
import { toDateString } from '../utils/dateUtils.js';
import { processCustomerImport } from '../services/importService.js';

/**
 * Helper to determine a customer's active status at a target date.
 * Rules:
 * - active: has an active subscription covering the date and date is not inside any pausePeriod.
 * - paused: has an active subscription covering the date but date falls inside a pausePeriod.
 * - inactive: no active subscription covering the date.
 */
export const getCustomerStatusAtDate = async (customerId, targetDate = toDateString(new Date())) => {
  const subscriptions = await Subscription.find({
    $or: [
      { customerId },
      { 'ownershipSegments.customerId': customerId }
    ],
    status: { $ne: 'cancelled' },
    cycleStart: { $lte: targetDate },
    cycleEnd: { $gte: targetDate }
  });

  if (!subscriptions || subscriptions.length === 0) {
    return 'inactive';
  }

  for (const sub of subscriptions) {
    // Check if the customer is the owner of the active segment on this date
    let isOwnerOnDate = String(sub.customerId) === String(customerId);
    if (sub.ownershipSegments && sub.ownershipSegments.length > 0) {
      const activeSegment = sub.ownershipSegments.find(
        s => s.startDate <= targetDate && s.endDate >= targetDate
      );
      if (activeSegment) {
        isOwnerOnDate = String(activeSegment.customerId) === String(customerId);
      }
    }

    if (!isOwnerOnDate) continue;

    // Check if covered by any pause period
    const pause = await PausePeriod.findOne({
      subscriptionId: sub._id,
      startDate: { $lte: targetDate },
      endDate: { $gte: targetDate }
    });

    if (pause || sub.status === 'paused') {
      return 'paused';
    }

    return 'active';
  }

  return 'inactive';
};

/**
 * POST /api/customers
 * Create a new customer
 */
export const createCustomer = async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ error: 'Customer phone is required' });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!isValidPhone(normalizedPhone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Check uniqueness
    const existing = await Customer.findOne({ phone: normalizedPhone });
    if (existing) {
      return res.status(409).json({ error: 'Customer with this phone number already exists' });
    }

    const customer = await Customer.create({
      name: String(name).trim(),
      phone: normalizedPhone,
      email: email ? String(email).trim() : '',
      address: address ? String(address).trim() : ''
    });

    return res.status(201).json(customer);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/customers/:phone
 * Retrieve customer by normalized phone, with current status and active subscriptions
 */
export const getCustomerByPhone = async (req, res) => {
  try {
    const { phone } = req.params;
    const normalizedPhone = normalizePhone(phone);

    const customer = await Customer.findOne({ phone: normalizedPhone });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const today = toDateString(new Date());
    const status = await getCustomerStatusAtDate(customer._id, today);

    // Get all subscriptions associated with this customer
    const subscriptions = await Subscription.find({
      $or: [
        { customerId: customer._id },
        { 'ownershipSegments.customerId': customer._id }
      ]
    }).sort({ cycleStart: -1 });

    return res.status(200).json({
      ...customer.toObject(),
      status,
      subscriptions
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/customers
 * Supports ?status=active, ?status=paused, ?phone=..., pagination, sorting
 */
export const getCustomers = async (req, res) => {
  try {
    const { status, phone, page = 1, limit = 50, sort = 'createdAt', order = 'desc' } = req.query;
    const today = toDateString(new Date());

    let query = {};
    if (phone) {
      const normalizedSearch = normalizePhone(phone);
      query.phone = { $regex: normalizedSearch, $options: 'i' };
    }

    const sortOrder = order === 'asc' ? 1 : -1;
    const customers = await Customer.find(query)
      .sort({ [sort]: sortOrder })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    // Enrich with status and current active subscription
    const enriched = await Promise.all(
      customers.map(async (cust) => {
        const custStatus = await getCustomerStatusAtDate(cust._id, today);
        const currentSub = await Subscription.findOne({
          $or: [
            { customerId: cust._id },
            { 'ownershipSegments.customerId': cust._id }
          ],
          cycleStart: { $lte: today },
          cycleEnd: { $gte: today },
          status: { $ne: 'cancelled' }
        });

        return {
          ...cust.toObject(),
          status: custStatus,
          activeSubscription: currentSub
        };
      })
    );

    // Filter by status if requested
    let filtered = enriched;
    if (status) {
      filtered = enriched.filter(c => c.status.toLowerCase() === status.toLowerCase());
    }

    return res.status(200).json({
      customers: filtered,
      count: filtered.length,
      page: Number(page)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/customers/import
 * T4 Messy customer import
 */
export const importCustomers = async (req, res) => {
  try {
    const records = req.body;
    const report = await processCustomerImport(records);
    return res.status(200).json(report);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
