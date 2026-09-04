import express from 'express';
import {
  getHcmStaff,
  createHcmStaff,
  updateHcmStaff,
  clockAttendance,
  getAttendance,
  generatePayroll,
  getPayrollRecords,
  getPayrollSummary,
  getPayslip,
  downloadPayslip,
  submitLeaveRequest,
  getLeaveRequests,
  reviewLeaveRequest
} from '../controllers/hcmController.js';
import { protectStaff, authorizePermissions } from '../middleware/erpAuth.js';

const router = express.Router();

// All HCM endpoints require authentication
router.use(protectStaff);

// --- STAFF / EMPLOYEES ENDPOINTS ---
router.get('/employees', getHcmStaff);
router.get('/staff', getHcmStaff);
router.post('/staff', authorizePermissions('staff:manage', 'admin'), createHcmStaff);
router.patch('/employees/:id', authorizePermissions('staff:manage', 'admin'), updateHcmStaff);
router.put('/staff/:id', authorizePermissions('staff:manage', 'admin'), updateHcmStaff);

// --- ATTENDANCE ENDPOINTS ---
router.get('/attendance', getAttendance);
router.post('/attendance/clock', clockAttendance);
router.post('/attendance/clock-in', (req, res, next) => {
  req.body.action = 'clockIn';
  next();
}, clockAttendance);
router.post('/attendance/clock-out', (req, res, next) => {
  req.body.action = 'clockOut';
  next();
}, clockAttendance);

// --- PAYROLL ENDPOINTS ---
router.post('/payroll/generate', authorizePermissions('staff:manage', 'payroll:write', 'admin'), generatePayroll);
router.get('/payroll/summary', getPayrollSummary);
router.get('/payroll', getPayrollRecords);
router.get('/payroll/:id/payslip', getPayslip);
router.get('/payroll/:id/download-payslip', downloadPayslip);

export default router;

// --- LEAVE MANAGEMENT ---
router.post('/leave', submitLeaveRequest);
router.get('/leave', getLeaveRequests);
router.put('/leave/:id/review', authorizePermissions('staff:manage', 'admin'), reviewLeaveRequest);
