import mongoose from 'mongoose';

const ownershipSegmentSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true
    },
    startDate: {
      type: String,
      required: true // YYYY-MM-DD
    },
    endDate: {
      type: String,
      required: true // YYYY-MM-DD
    }
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'customerId is required'],
      index: true
    },
    planName: {
      type: String,
      trim: true,
      default: 'Standard Lunch Plan'
    },
    monthlyPrice: {
      type: Number,
      required: [true, 'monthlyPrice is required'],
      min: [0.01, 'monthlyPrice must be greater than 0']
    },
    cycleStart: {
      type: String,
      required: [true, 'cycleStart is required'] // YYYY-MM-DD
    },
    cycleEnd: {
      type: String,
      required: [true, 'cycleEnd is required'] // YYYY-MM-DD
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'cancelled', 'transferred'],
      default: 'active'
    },
    ownershipSegments: {
      type: [ownershipSegmentSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Index on dates and customer for rapid lookup
subscriptionSchema.index({ customerId: 1, cycleStart: 1, cycleEnd: 1 });

export default mongoose.model('Subscription', subscriptionSchema);
