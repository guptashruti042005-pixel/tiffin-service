import mongoose from 'mongoose';

const outboxSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true
    },
    type: {
      type: String,
      default: 'DELIVERY_DUE'
    },
    date: {
      type: String,
      required: true, // YYYY-MM-DD
      index: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      default: 'SENT'
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model('Outbox', outboxSchema);
