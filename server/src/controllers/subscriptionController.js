import mongoose from 'mongoose';
import Subscription from '../models/Subscription.js';
import Customer from '../models/Customer.js';
import PausePeriod from '../models/PausePeriod.js';
import { parseMessyDate, toDateString, addDays } from '../utils/dateUtils.js';
import { calculateSubscriptionBill } from '../utils/billingCalculator.js';

/**
 * POST /api/subscriptions
 * Create a new subscription cycle
 */
export const createSubscription = async (req, res) => {
  try {
    const { customerId, planName, monthlyPrice, cycleStart, cycleEnd } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ error: 'Invalid customerId format' });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const numPrice = Number(monthlyPrice);
    if (isNaN(numPrice) || numPrice <= 0) {
      return res.status(400).json({ error: 'monthlyPrice must be a number greater than 0' });
    }

    const cleanStart = parseMessyDate(cycleStart);
    const cleanEnd = parseMessyDate(cycleEnd);

    if (!cleanStart || !cleanEnd) {
      return res.status(400).json({ error: 'Valid cycleStart and cycleEnd are required' });
    }

    if (cleanStart > cleanEnd) {
      return res.status(400).json({ error: 'cycleStart must be before or equal to cycleEnd' });
    }

    // Initialize with first ownership segment
    const initialSegment = {
      customerId,
      startDate: cleanStart,
      endDate: cleanEnd
    };

    const subscription = await Subscription.create({
      customerId,
      planName: planName ? String(planName).trim() : 'Standard Lunch Plan',
      monthlyPrice: numPrice,
      cycleStart: cleanStart,
      cycleEnd: cleanEnd,
      status: 'active',
      ownershipSegments: [initialSegment]
    });

    return res.status(201).json(subscription);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/subscriptions/:id
 * Retrieve subscription details, pause history, and populated customer
 */
export const getSubscriptionById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid subscription ID' });
    }

    const subscription = await Subscription.findById(id).populate('customerId');
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const pausePeriods = await PausePeriod.find({ subscriptionId: id }).sort({ startDate: 1 });

    return res.status(200).json({
      ...subscription.toObject(),
      pausePeriods
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/subscriptions/:id/pause
 * Record an inclusive pause period
 */
export const pauseSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid subscription ID' });
    }

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const cleanStart = parseMessyDate(startDate);
    const cleanEnd = parseMessyDate(endDate);

    if (!cleanStart || !cleanEnd) {
      return res.status(400).json({ error: 'Valid startDate and endDate are required' });
    }

    if (cleanStart > cleanEnd) {
      return res.status(400).json({ error: 'startDate cannot be after endDate' });
    }

    // Validate that pause lies at least partially within the subscription cycle
    if (cleanEnd < subscription.cycleStart || cleanStart > subscription.cycleEnd) {
      return res.status(400).json({
        error: `Pause range [${cleanStart}, ${cleanEnd}] falls outside cycle [${subscription.cycleStart}, ${subscription.cycleEnd}]`
      });
    }

    // Check for exact duplicate pause
    const exactExisting = await PausePeriod.findOne({
      subscriptionId: id,
      startDate: cleanStart,
      endDate: cleanEnd
    });

    let pauseRecord;
    if (exactExisting) {
      pauseRecord = exactExisting;
    } else {
      pauseRecord = await PausePeriod.create({
        subscriptionId: id,
        startDate: cleanStart,
        endDate: cleanEnd,
        reason: reason ? String(reason).trim() : ''
      });
    }

    // Update current status if today is inside the pause
    const today = toDateString(new Date());
    if (today >= cleanStart && today <= cleanEnd) {
      subscription.status = 'paused';
      await subscription.save();
    }

    return res.status(201).json(pauseRecord);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/subscriptions/:id/resume
 * Resumes subscription by terminating any active pause periods
 */
export const resumeSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid subscription ID' });
    }

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const today = toDateString(new Date());
    const yesterday = addDays(today, -1);

    // Find any pauses covering today or future
    const activePauses = await PausePeriod.find({
      subscriptionId: id,
      endDate: { $gte: today }
    });

    for (const pause of activePauses) {
      if (pause.startDate > today) {
        // Future pause -> remove it
        await PausePeriod.findByIdAndDelete(pause._id);
      } else {
        // Ongoing pause -> shorten endDate to yesterday (or today)
        pause.endDate = yesterday < pause.startDate ? pause.startDate : yesterday;
        await pause.save();
      }
    }

    subscription.status = 'active';
    await subscription.save();

    return res.status(200).json({
      message: 'Subscription resumed successfully',
      status: 'active',
      subscription
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/subscriptions/:id/bill
 * Computes deterministic pro-rated bill for the cycle
 */
export const getSubscriptionBill = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid subscription ID' });
    }

    const subscription = await Subscription.findById(id).populate('customerId');
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const pausePeriods = await PausePeriod.find({ subscriptionId: id });
    const bill = calculateSubscriptionBill(subscription, pausePeriods);

    // Populate segment customer details if transfer occurred
    const enrichedSegments = await Promise.all(
      bill.segmentsBreakdown.map(async (seg) => {
        const cust = await Customer.findById(seg.customerId);
        return {
          ...seg,
          customer: cust ? { id: cust._id, name: cust.name, phone: cust.phone } : null
        };
      })
    );

    return res.status(200).json({
      customer: {
        id: subscription.customerId?._id || subscription.customerId,
        name: subscription.customerId?.name || 'Customer',
        phone: subscription.customerId?.phone || ''
      },
      plan: subscription.planName,
      cycleStart: bill.cycleStart,
      cycleEnd: bill.cycleEnd,
      monthlyPrice: bill.monthlyPrice,
      totalWeekdays: bill.totalWeekdays,
      pausedWeekdays: bill.pausedWeekdays,
      servedWeekdays: bill.servedWeekdays,
      amountDue: bill.amountDue,
      pausePeriods: bill.pausePeriodsUsed,
      segments: enrichedSegments
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/subscriptions/:id/transfer
 * T6 Transfer a subscription to a new customer mid-cycle
 */
export const transferSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { newCustomerId, transferDate } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid subscription ID' });
    }

    if (!newCustomerId || !mongoose.Types.ObjectId.isValid(newCustomerId)) {
      return res.status(400).json({ error: 'Valid newCustomerId is required' });
    }

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const newCustomer = await Customer.findById(newCustomerId);
    if (!newCustomer) {
      return res.status(404).json({ error: 'New customer not found' });
    }

    if (String(subscription.customerId) === String(newCustomerId)) {
      return res.status(400).json({ error: 'Subscription is already owned by this customer' });
    }

    // Determine effective transfer date
    const cleanTransferDate = transferDate ? parseMessyDate(transferDate) : toDateString(new Date());
    if (!cleanTransferDate) {
      return res.status(400).json({ error: 'Invalid transferDate format' });
    }

    if (cleanTransferDate < subscription.cycleStart || cleanTransferDate > subscription.cycleEnd) {
      return res.status(400).json({
        error: `transferDate ${cleanTransferDate} must lie within cycle [${subscription.cycleStart}, ${subscription.cycleEnd}]`
      });
    }

    // Semantics:
    // Old customer served before transferDate (up to transferDate - 1 day).
    // New customer served from transferDate onward (to cycleEnd).
    const prevDay = addDays(cleanTransferDate, -1);

    // Initialize segments if empty
    if (!subscription.ownershipSegments || subscription.ownershipSegments.length === 0) {
      subscription.ownershipSegments = [
        {
          customerId: subscription.customerId,
          startDate: subscription.cycleStart,
          endDate: subscription.cycleEnd
        }
      ];
    }

    // Find the current active segment ending at cycleEnd
    const lastSegIndex = subscription.ownershipSegments.length - 1;
    const lastSeg = subscription.ownershipSegments[lastSegIndex];

    if (cleanTransferDate <= lastSeg.startDate) {
      // Transfer takes effect from start of segment
      lastSeg.customerId = newCustomerId;
    } else {
      // Shorten old segment and append new segment
      lastSeg.endDate = prevDay;
      subscription.ownershipSegments.push({
        customerId: newCustomerId,
        startDate: cleanTransferDate,
        endDate: subscription.cycleEnd
      });
    }

    // Update active owner
    subscription.customerId = newCustomerId;
    await subscription.save();

    return res.status(200).json({
      message: 'Subscription transferred successfully',
      transferDate: cleanTransferDate,
      subscription
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
