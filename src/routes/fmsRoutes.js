import express from 'express';
import {
  getAccounts,
  createAccount,
  getJournalEntries,
  createJournalEntry,
  getAPInvoices,
  createAPInvoice,
  updateAPStatus,
  getARInvoices,
  createARInvoice,
  updateARStatus,
  getFinancialReports,
} from '../controllers/fmsController.js';
import { protectStaff } from '../middleware/erpAuth.js';

const router = express.Router();

// Chart of Accounts
router.get('/accounts', protectStaff, getAccounts);
router.post('/accounts', protectStaff, createAccount);

// Journal Entries
router.get('/journal-entries', protectStaff, getJournalEntries);
router.post('/journal-entries', protectStaff, createJournalEntry);

// Accounts Payable (AP)
router.get('/ap', protectStaff, getAPInvoices);
router.post('/ap', protectStaff, createAPInvoice);
router.patch('/ap/:id/payment', protectStaff, updateAPStatus);

// Accounts Receivable (AR)
router.get('/ar', protectStaff, getARInvoices);
router.post('/ar', protectStaff, createARInvoice);
router.patch('/ar/:id/payment', protectStaff, updateARStatus);

// Financial Reports
router.get('/reports', protectStaff, getFinancialReports);

export default router;
