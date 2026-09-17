import express from 'express';
import { getOutboxEvents } from '../controllers/outboxController.js';

const router = express.Router();

router.get('/', getOutboxEvents);

export default router;
