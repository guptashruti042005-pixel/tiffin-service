import express from 'express';
import { triggerClock } from '../controllers/clockController.js';

const router = express.Router();

router.post('/', triggerClock);

export default router;
