import express from 'express';
import {
  loginStaff,
  getStaffProfile,
  getAllStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  getErpProducts,
  createErpProduct,
  updateErpProduct,
  deleteErpProduct,
  createPOSSale,
  getErpOrders,
  updateErpOrderStatus,
  getErpReports,
  downloadPOSReceipt
} from '../controllers/erpController.js';
import { protectStaff, authorizeRoles, authorizePermissions } from '../middleware/erpAuth.js';
import { checkTrialLimit } from '../middleware/trialMiddleware.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// --- PUBLIC AUTH ROUTE ---
router.post('/auth/login', loginStaff);

// --- PROTECTED AUTH ROUTE ---
router.get('/auth/me', protectStaff, getStaffProfile);

// --- STAFF MANAGEMENT (CEO & HR) ---
router.get('/staff', protectStaff, authorizeRoles('CEO', 'HR'), getAllStaff);
router.post('/staff', protectStaff, authorizeRoles('CEO', 'HR'), createStaff);
router.put('/staff/:id', protectStaff, authorizeRoles('CEO', 'HR'), updateStaff);
router.delete('/staff/:id', protectStaff, authorizeRoles('CEO', 'HR'), deleteStaff);

// --- INVENTORY / PRODUCTS ---
// Read inventory (CEO, Finance, Cashier, WebAdmin)
router.get('/products', protectStaff, authorizeRoles('CEO', 'Finance', 'Cashier', 'WebAdmin'), getErpProducts);
// Add product (CEO, WebAdmin) - unblocked without artificial 10 cap
router.post('/products', protectStaff, authorizeRoles('CEO', 'WebAdmin'), upload.single('image'), createErpProduct);
// Edit product (CEO, WebAdmin)
router.put('/products/:id', protectStaff, authorizeRoles('CEO', 'WebAdmin'), upload.single('image'), updateErpProduct);
// Delete product (CEO, WebAdmin)
router.delete('/products/:id', protectStaff, authorizeRoles('CEO', 'WebAdmin'), deleteErpProduct);

// --- POS SALES TERMINAL ---
// Create POS sale (CEO, Cashier)
router.post('/pos', protectStaff, authorizeRoles('CEO', 'Cashier'), createPOSSale);
router.post('/pos/sale', protectStaff, authorizeRoles('CEO', 'Cashier'), createPOSSale);

// --- ORDERS FEED ---
// Get orders list (CEO, Finance, Cashier, WebAdmin)
router.get('/orders', protectStaff, authorizeRoles('CEO', 'Finance', 'Cashier', 'WebAdmin'), getErpOrders);
router.get('/orders/:id/receipt', protectStaff, authorizePermissions('orders:read'), downloadPOSReceipt);
// Update order status (CEO, WebAdmin)
router.put('/orders/:id/status', protectStaff, authorizeRoles('CEO', 'WebAdmin'), updateErpOrderStatus);

// --- FINANCIAL REPORTS & ANALYTICS ---
// Financial breakdown (CEO, Finance)
router.get('/reports', protectStaff, authorizeRoles('CEO', 'Finance'), getErpReports);

export default router;
