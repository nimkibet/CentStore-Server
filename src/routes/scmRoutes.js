import express from 'express';
import {
  createVendor,
  getVendors,
  createWarehouse,
  getWarehouses,
  createPurchaseOrder,
  getPurchaseOrders,
  updatePurchaseOrderStatus,
  triggerLowStockDraftPO
} from '../controllers/scmController.js';
import { protectStaff, authorizePermissions } from '../middleware/erpAuth.js';

const router = express.Router();

// --- VENDORS ---
router.post(
  '/vendors',
  protectStaff,
  authorizePermissions('scm:write', 'inventory:write'),
  createVendor
);
router.get(
  '/vendors',
  protectStaff,
  authorizePermissions('scm:read', 'inventory:read'),
  getVendors
);

// --- WAREHOUSES ---
router.post(
  '/warehouses',
  protectStaff,
  authorizePermissions('scm:write', 'inventory:write'),
  createWarehouse
);
router.get(
  '/warehouses',
  protectStaff,
  authorizePermissions('scm:read', 'inventory:read'),
  getWarehouses
);

// --- PURCHASE ORDERS ---
router.post(
  '/purchase-orders',
  protectStaff,
  authorizePermissions('scm:write', 'inventory:write'),
  createPurchaseOrder
);
router.get(
  '/purchase-orders',
  protectStaff,
  authorizePermissions('scm:read', 'inventory:read'),
  getPurchaseOrders
);
router.patch(
  '/purchase-orders/:id/status',
  protectStaff,
  authorizePermissions('scm:write', 'inventory:write'),
  updatePurchaseOrderStatus
);
router.post(
  '/purchase-orders/auto-trigger',
  protectStaff,
  authorizePermissions('scm:write', 'inventory:write'),
  triggerLowStockDraftPO
);

export default router;
