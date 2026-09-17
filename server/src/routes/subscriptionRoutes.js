import express from 'express';
import {
  createSubscription,
  getSubscriptionById,
  pauseSubscription,
  resumeSubscription,
  getSubscriptionBill,
  transferSubscription
} from '../controllers/subscriptionController.js';

const router = express.Router();

router.post('/', createSubscription);
router.get('/:id', getSubscriptionById);
router.post('/:id/pause', pauseSubscription);
router.post('/:id/resume', resumeSubscription);
router.get('/:id/bill', getSubscriptionBill);
router.post('/:id/transfer', transferSubscription);

export default router;
