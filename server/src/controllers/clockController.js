import Subscription from '../models/Subscription.js';
import Customer from '../models/Customer.js';
import PausePeriod from '../models/PausePeriod.js';
import Outbox from '../models/Outbox.js';
import { isWeekday, parseMessyDate, toDateString } from '../utils/dateUtils.js';
import notificationService from '../services/notificationService.js';

/**
 * POST /api/clock
 * T1 Delivery Notification Integration
 * Dispatches notifications for all active, unpaused customers due a delivery on the given weekday.
 */
export const triggerClock = async (req, res) => {
  try {
    const rawDate = req.body.date || toDateString(new Date());
    const date = parseMessyDate(rawDate);

    if (!date) {
      return res.status(400).json({ error: 'Valid date (YYYY-MM-DD) is required' });
    }

    // 1. Weekend check: Weekend deliveries are NEVER scheduled
    if (!isWeekday(date)) {
      return res.status(200).json({
        success: true,
        date,
        isWeekday: false,
        message: 'Weekend: no deliveries scheduled',
        notifiedCount: 0,
        notifications: []
      });
    }

    // 2. Find subscriptions covering this date
    const subscriptions = await Subscription.find({
      cycleStart: { $lte: date },
      cycleEnd: { $gte: date },
      status: { $ne: 'cancelled' }
    });

    const notifications = [];

    for (const sub of subscriptions) {
      // 3. Exclude customers paused on this date
      const pause = await PausePeriod.findOne({
        subscriptionId: sub._id,
        startDate: { $lte: date },
        endDate: { $gte: date }
      });

      if (pause) {
        // Customer is paused -> skip
        continue;
      }

      // Determine who owns the subscription on this specific date (T6 transfer support)
      let activeCustomerId = sub.customerId;
      if (sub.ownershipSegments && sub.ownershipSegments.length > 0) {
        const matchingSeg = sub.ownershipSegments.find(
          s => s.startDate <= date && s.endDate >= date
        );
        if (matchingSeg) {
          activeCustomerId = matchingSeg.customerId;
        }
      }

      const customer = await Customer.findById(activeCustomerId);
      if (!customer) continue;

      // 4. Send delivery notification through service abstraction
      const notifResult = await notificationService.sendDeliveryNotification({
        customer,
        subscription: sub,
        date
      });

      // 5. Record outbox event in database
      const outboxEvent = await Outbox.create({
        customerId: customer._id,
        subscriptionId: sub._id,
        type: 'DELIVERY_DUE',
        date,
        timestamp: new Date(),
        status: notifResult.success ? 'SENT' : 'FAILED',
        payload: {
          customerName: customer.name,
          customerPhone: customer.phone,
          planName: sub.planName,
          message: notifResult.message
        }
      });

      notifications.push({
        outboxId: outboxEvent._id,
        customerId: customer._id,
        customerName: customer.name,
        phone: customer.phone,
        plan: sub.planName,
        date
      });
    }

    return res.status(200).json({
      success: true,
      date,
      isWeekday: true,
      notifiedCount: notifications.length,
      notifications
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
