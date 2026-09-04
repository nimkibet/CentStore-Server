import LeaveRequest from '../models/LeaveRequest.js';
import { generatePayslipPDF } from '../utils/pdfGenerator.js';
import { createPayrollJournalEntry } from '../services/autoAccounting.js';
import Staff from '../models/Staff.js';
import Attendance from '../models/Attendance.js';
import Payroll from '../models/Payroll.js';

// --- STATUTORY DEDUCTION CALCULATION ENGINE ---
export const calculateStatutoryDeductions = (basicSalary, allowances = 0, loans = 0) => {
  const grossSalary = basicSalary + allowances;

  // 1. NSSF (Kenya Tier I & Tier II capped at KES 2,160)
  let nssf = 0;
  if (grossSalary > 0) {
    const tier1 = Math.min(grossSalary, 7000) * 0.06;
    const tier2 = Math.max(0, Math.min(grossSalary, 36000) - 7000) * 0.06;
    nssf = Math.round(tier1 + tier2);
  }

  // 2. SHIF / NHIF (2.75% of gross salary, min KES 300)
  let shif = 0;
  if (grossSalary > 0) {
    shif = Math.max(300, Math.round(grossSalary * 0.0275));
  }

  // 3. Housing Levy (1.5% of gross salary)
  let housingLevy = 0;
  if (grossSalary > 0) {
    housingLevy = Math.round(grossSalary * 0.015);
  }

  // 4. PAYE Tax Calculation (Taxable Income = Gross Salary - NSSF)
  const taxableIncome = Math.max(0, grossSalary - nssf);
  let grossTax = 0;

  if (taxableIncome <= 24000) {
    grossTax = taxableIncome * 0.10;
  } else if (taxableIncome <= 32333) {
    grossTax = (24000 * 0.10) + ((taxableIncome - 24000) * 0.25);
  } else if (taxableIncome <= 500000) {
    grossTax = (24000 * 0.10) + (8333 * 0.25) + ((taxableIncome - 32333) * 0.30);
  } else if (taxableIncome <= 800000) {
    grossTax = (24000 * 0.10) + (8333 * 0.25) + (467667 * 0.30) + ((taxableIncome - 500000) * 0.325);
  } else {
    grossTax = (24000 * 0.10) + (8333 * 0.25) + (467667 * 0.30) + (300000 * 0.325) + ((taxableIncome - 800000) * 0.35);
  }

  const personalRelief = 2400;
  const paye = Math.max(0, Math.round(grossTax - personalRelief));

  const totalDeductions = paye + nssf + shif + housingLevy + loans;
  const netSalary = Math.max(0, grossSalary - totalDeductions);

  return {
    grossSalary,
    deductions: {
      paye,
      nssf,
      shif,
      housingLevy,
      loans
    },
    totalDeductions,
    netSalary
  };
};

// --- 1. STAFF MANAGEMENT ENDPOINTS ---

export const getHcmStaff = async (req, res) => {
  try {
    const { department, status, search } = req.query;
    const query = {};

    if (department && department !== 'All') query.department = department;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const staffList = await Staff.find(query).select('-password').sort({ createdAt: -1 });
    res.json(staffList);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch staff profiles: ' + err.message });
  }
};

export const createHcmStaff = async (req, res) => {
  try {
    const {
      name, email, password, role, permissions, department, position,
      employmentStatus, basicSalary, allowances, statutoryDeductions,
      phone, taxId, nhifNumber, nssfNumber, bankDetails, emergencyContacts, hireDate
    } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required' });
    }

    const existing = await Staff.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ error: 'Staff member with this email already exists' });
    }

    const newStaff = new Staff({
      name,
      email: email.toLowerCase().trim(),
      password,
      role,
      permissions: permissions || [],
      department: department || 'General',
      position: position || role,
      employmentStatus: employmentStatus || 'full_time',
      basicSalary: Number(basicSalary) || 0,
      allowances: Number(allowances) || 0,
      statutoryDeductions: Number(statutoryDeductions) || 0,
      phone: phone || '',
      taxId: taxId || '',
      nhifNumber: nhifNumber || '',
      nssfNumber: nssfNumber || '',
      bankDetails: bankDetails || {},
      emergencyContacts: emergencyContacts || [],
      hireDate: hireDate ? new Date(hireDate) : new Date(),
      status: 'active'
    });

    await newStaff.save();

    const result = newStaff.toObject();
    delete result.password;

    
      const totalGross       = generatedRecords.reduce((s, p) => s + (p.grossSalary || 0), 0);
      const totalNet         = generatedRecords.reduce((s, p) => s + (p.netSalary || 0), 0);
      const totalPAYE        = generatedRecords.reduce((s, p) => s + (p.deductions?.paye || 0), 0);
      const totalNSSF        = generatedRecords.reduce((s, p) => s + (p.deductions?.nssf || 0), 0);
      const totalSHIF        = generatedRecords.reduce((s, p) => s + (p.deductions?.shif || 0), 0);
      const totalHousingLevy = generatedRecords.reduce((s, p) => s + (p.deductions?.housingLevy || 0), 0);
      
      createPayrollJournalEntry({ period: payPeriod, totalGross, totalNet, totalPAYE, totalNSSF, totalSHIF, totalHousingLevy });
      
      res.status(201).json({
      message: 'Staff HR profile created successfully',
      staff: result
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create staff profile: ' + err.message });
  }
};

export const updateHcmStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    delete updates.password; // Prevent password override through HR update

    if (updates.basicSalary !== undefined) updates.basicSalary = Number(updates.basicSalary);
    if (updates.allowances !== undefined) updates.allowances = Number(updates.allowances);
    if (updates.statutoryDeductions !== undefined) updates.statutoryDeductions = Number(updates.statutoryDeductions);

    const updatedStaff = await Staff.findByIdAndUpdate(id, updates, { new: true }).select('-password');
    if (!updatedStaff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    res.json({
      message: 'Staff HR profile updated successfully',
      staff: updatedStaff
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update staff profile: ' + err.message });
  }
};

// --- 2. ATTENDANCE CLOCKING ENDPOINTS ---

export const clockAttendance = async (req, res) => {
  try {
    const targetStaffId = req.body.staffId || req.staff?._id;
    if (!targetStaffId) {
      return res.status(400).json({ error: 'Staff ID is required' });
    }

    const { action, notes } = req.body;

    const activeSession = await Attendance.findOne({
      staffId: targetStaffId,
      clockOut: { $exists: false }
    });

    const isClockIn = action === 'clockIn' || (!action && !activeSession);

    if (isClockIn) {
      if (activeSession) {
        return res.status(400).json({ error: 'Already clocked in. Please clock out first.' });
      }

      const now = new Date();
      const hours = now.getHours();
      const status = hours >= 9 && now.getMinutes() > 15 ? 'late' : 'present';

      const newAttendance = new Attendance({
        staffId: targetStaffId,
        date: now,
        clockIn: now,
        status,
        totalHours: 0,
        notes: notes || ''
      });

      await newAttendance.save();
      return res.status(201).json({
        message: 'Clock-in successful',
        attendance: newAttendance
      });
    } else {
      if (!activeSession) {
        return res.status(400).json({ error: 'No active clock-in session found' });
      }

      const now = new Date();
      const durationMs = now.getTime() - new Date(activeSession.clockIn).getTime();
      const totalHours = Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100;

      activeSession.clockOut = now;
      activeSession.totalHours = totalHours;
      if (notes) {
        activeSession.notes = activeSession.notes ? `${activeSession.notes} | ${notes}` : notes;
      }

      await activeSession.save();
      return res.json({
        message: 'Clock-out successful',
        attendance: activeSession
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Attendance operation failed: ' + err.message });
  }
};

export const getAttendance = async (req, res) => {
  try {
    const { staffId, startDate, endDate } = req.query;
    const query = {};

    if (staffId) query.staffId = staffId;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate );
      if (endDate) query.date.$lte = new Date(endDate );
    }

    const records = await Attendance.find(query)
      .populate('staffId', 'name email department position')
      .sort({ date: -1, clockIn: -1 });

    res.json(records);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch attendance records: ' + err.message });
  }
};

// --- 3. PAYROLL GENERATION ENGINE ENDPOINTS ---

export const generatePayroll = async (req, res) => {
  try {
    const { payPeriod, department } = req.body;
    if (!payPeriod) {
      return res.status(400).json({ error: 'payPeriod is required (format: YYYY-MM)' });
    }

    const staffQuery = { status: 'active' };
    if (department && department !== 'All') staffQuery.department = department;

    const staffMembers = await Staff.find(staffQuery);
    if (staffMembers.length === 0) {
      return res.status(404).json({ error: 'No active staff members found for payroll generation' });
    }

    const generatedRecords = [];

    for (const staff of staffMembers) {
      const basicSalary = staff.basicSalary || 0;
      const allowances = staff.allowances || 0;
      const loans = staff.statutoryDeductions || 0;

      const calc = calculateStatutoryDeductions(basicSalary, allowances, loans);
      const staffRefId = staff._id.toString().slice(-6).toUpperCase();
      const payslipRef = `PAY-${payPeriod.replace('-', '')}-${staffRefId}`;

      const payrollEntry = await Payroll.findOneAndUpdate(
        { staffId: staff._id, payPeriod },
        {
          staffId: staff._id,
          payPeriod,
          basicSalary,
          allowances,
          grossSalary: calc.grossSalary,
          deductions: calc.deductions,
          totalDeductions: calc.totalDeductions,
          netSalary: calc.netSalary,
          status: 'processed',
          payslipRef,
          paymentDate: new Date()
        },
        { upsert: true, new: true }
      );

      generatedRecords.push(payrollEntry);
    }

    res.status(201).json({
      message: `Successfully generated payroll for ${generatedRecords.length} staff members for period ${payPeriod}`,
      payPeriod,
      staffProcessedCount: generatedRecords.length,
      records: generatedRecords
    });
  } catch (err) {
    res.status(500).json({ error: 'Payroll generation failed: ' + err.message });
  }
};

export const getPayrollRecords = async (req, res) => {
  try {
    const { payPeriod, staffId, status } = req.query;
    const query = {};

    if (payPeriod) query.payPeriod = payPeriod;
    if (staffId) query.staffId = staffId;
    if (status) query.status = status;

    const records = await Payroll.find(query)
      .populate('staffId', 'name email department position taxId nhifNumber nssfNumber bankDetails')
      .sort({ createdAt: -1 });

    res.json(records);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payroll records: ' + err.message });
  }
};

export const getPayrollSummary = async (req, res) => {
  try {
    const { payPeriod, department } = req.query;

    const query = {};
    if (payPeriod) query.payPeriod = payPeriod;

    let payrollRecords = await Payroll.find(query).populate('staffId', 'department name email position');

    if (department && department !== 'All') {
      payrollRecords = payrollRecords.filter((p) => p.staffId && p.staffId.department === department);
    }

    const totalGrossSalary = payrollRecords.reduce((acc, p) => acc + (p.grossSalary || 0), 0);
    const totalDeductions = payrollRecords.reduce((acc, p) => acc + (p.totalDeductions || 0), 0);
    const totalNetSalary = payrollRecords.reduce((acc, p) => acc + (p.netSalary || 0), 0);
    const totalBasicSalary = payrollRecords.reduce((acc, p) => acc + (p.basicSalary || 0), 0);
    const totalAllowances = payrollRecords.reduce((acc, p) => acc + (p.allowances || 0), 0);
    
    const totalPaye = payrollRecords.reduce((acc, p) => acc + (p.deductions?.paye || 0), 0);
    const totalNssf = payrollRecords.reduce((acc, p) => acc + (p.deductions?.nssf || 0), 0);
    const totalShif = payrollRecords.reduce((acc, p) => acc + (p.deductions?.shif || 0), 0);
    const totalHousingLevy = payrollRecords.reduce((acc, p) => acc + (p.deductions?.housingLevy || 0), 0);
    const totalLoans = payrollRecords.reduce((acc, p) => acc + (p.deductions?.loans || 0), 0);

    // Group by department
    const deptMap = {};
    for (const record of payrollRecords) {
      const dept = (record.staffId )?.department || 'General';
      if (!deptMap[dept]) {
        deptMap[dept] = { staffCount: 0, grossSalary: 0, netSalary: 0 };
      }
      deptMap[dept].staffCount += 1;
      deptMap[dept].grossSalary += record.grossSalary || 0;
      deptMap[dept].netSalary += record.netSalary || 0;
    }

    const departmentBreakdown = Object.keys(deptMap).map(dept => ({
      department: dept,
      ...deptMap[dept]
    }));

    res.json({
      payPeriod: payPeriod || 'Latest',
      staffCount: payrollRecords.length,
      totalGrossSalary,
      totalDeductions,
      totalNetSalary,
      breakdown: {
        totalBasicSalary,
        totalAllowances,
        totalPaye,
        totalNssf,
        totalShif,
        totalHousingLevy,
        totalLoans
      },
      departmentBreakdown
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve payroll summary: ' + err.message });
  }
};

export const getPayslip = async (req, res) => {
  try {
    const { id } = req.params;
    const payroll = await Payroll.findById(id).populate('staffId', 'name email department position phone bankDetails taxId nhifNumber nssfNumber');

    if (!payroll) {
      return res.status(404).json({ error: 'Payslip record not found' });
    }

    const currentStaff = req.staff;
    const staffDoc = payroll.staffId ;
    const isOwner = currentStaff?._id?.toString() === staffDoc?._id?.toString();
    const isHR = currentStaff?.permissions?.includes('admin') ||
                 currentStaff?.permissions?.includes('hcm:read') ||
                 currentStaff?.permissions?.includes('payroll:read') ||
                 currentStaff?.permissions?.includes('staff:manage');

    if (!isOwner && !isHR) {
      return res.status(403).json({ error: 'Access Denied: You do not have permission to view this payslip' });
    }

    res.json({
      payslipId: payroll._id,
      payslipRef: payroll.payslipRef,
      payPeriod: payroll.payPeriod,
      paymentDate: payroll.paymentDate || payroll.createdAt,
      employee: {
        id: staffDoc?._id,
        name: staffDoc?.name || 'N/A',
        email: staffDoc?.email || 'N/A',
        department: staffDoc?.department || 'General',
        position: staffDoc?.position || 'N/A',
        phone: staffDoc?.phone || '',
        taxId: staffDoc?.taxId || '',
        nhifNumber: staffDoc?.nhifNumber || '',
        nssfNumber: staffDoc?.nssfNumber || '',
        bankDetails: staffDoc?.bankDetails || {}
      },
      earnings: {
        basicSalary: payroll.basicSalary,
        allowances: payroll.allowances,
        grossSalary: payroll.grossSalary
      },
      deductions: payroll.deductions,
      totalDeductions: payroll.totalDeductions,
      netSalary: payroll.netSalary,
      status: payroll.status,
      createdAt: payroll.createdAt
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payslip: ' + err.message });
  }
};

export const downloadPayslip = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id).populate('staffId', 'name department position');
    if (!payroll) return res.status(404).json({ error: 'Payslip not found' });
    const pdfBuffer = await generatePayslipPDF(payroll);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Payslip_${payroll.payslipRef}.pdf"`,
      'Content-Length': pdfBuffer.length
    });
    res.end(pdfBuffer);
  } catch (err) { res.status(500).json({ error: 'Failed to generate payslip: ' + err.message }); }
};

export const submitLeaveRequest = async (req, res) => {
  try {
    const leave = await new LeaveRequest({ ...req.body, staffId: req.staff._id }).save();
    res.status(201).json(leave);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const getLeaveRequests = async (req, res) => {
  try {
    const query = req.staff.role === 'CEO' ? {} : { staffId: req.staff._id };
    const leaves = await LeaveRequest.find(query).populate('staffId', 'name department').sort({ createdAt: -1 });
    res.json(leaves);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const reviewLeaveRequest = async (req, res) => {
  try {
    const { status, reviewNotes } = req.body;
    const leave = await LeaveRequest.findByIdAndUpdate(req.params.id, 
      { status, reviewNotes, reviewedBy: req.staff._id, reviewedAt: new Date() }, { new: true }
    );
    res.json(leave);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
