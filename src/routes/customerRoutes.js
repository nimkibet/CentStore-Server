import express from 'express';
import {
  getCustomers,
  createCustomer,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  getCustomerPurchaseHistory
} from '../controllers/customerController.js';
import { protectStaff, authorizePermissions } from '../middleware/erpAuth.js';

const router = express.Router();

router.use(protectStaff);

router.get('/', authorizePermissions('crm:read', 'admin'), getCustomers);
router.post('/', authorizePermissions('crm:write', 'admin'), createCustomer);
router.get('/:id', authorizePermissions('crm:read', 'admin'), getCustomerById);
router.put('/:id', authorizePermissions('crm:write', 'admin'), updateCustomer);
router.delete('/:id', authorizePermissions('crm:write', 'admin'), deleteCustomer);
router.get('/:id/purchases', authorizePermissions('crm:read', 'admin'), getCustomerPurchaseHistory);

export default router;
