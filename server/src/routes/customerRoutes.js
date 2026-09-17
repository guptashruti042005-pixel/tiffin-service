import express from 'express';
import {
  createCustomer,
  getCustomerByPhone,
  getCustomers,
  importCustomers
} from '../controllers/customerController.js';

const router = express.Router();

router.post('/import', importCustomers);
router.post('/', createCustomer);
router.get('/', getCustomers);
router.get('/:phone', getCustomerByPhone);

export default router;
