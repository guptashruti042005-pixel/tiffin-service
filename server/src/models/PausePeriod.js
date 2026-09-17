import mongoose from 'mongoose';

const pausePeriodSchema = new mongoose.Schema(
  {
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: [true, 'subscriptionId is required'],
      index: true
    },
    startDate: {
      type: String,
      required: [true, 'startDate is required'] // YYYY-MM-DD
    },
    endDate: {
      type: String,
      required: [true, 'endDate is required'] // YYYY-MM-DD
    },
    reason: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

pausePeriodSchema.index({ subscriptionId: 1, startDate: 1, endDate: 1 });

export default mongoose.model('PausePeriod', pausePeriodSchema);
