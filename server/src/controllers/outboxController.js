import Outbox from '../models/Outbox.js';

/**
 * GET /outbox (and GET /api/outbox)
 * T1 Outbox Inspection Endpoint
 */
export const getOutboxEvents = async (req, res) => {
  try {
    const { date, customerId } = req.query;

    const filter = {};
    if (date) filter.date = date;
    if (customerId) filter.customerId = customerId;

    const events = await Outbox.find(filter)
      .populate('customerId', 'name phone email')
      .populate('subscriptionId', 'planName cycleStart cycleEnd')
      .sort({ timestamp: -1 });

    return res.status(200).json(events);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
