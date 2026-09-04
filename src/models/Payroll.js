import mongoose, { Schema, Document, Types } from 'mongoose';



const payrollDeductionsSchema = new Schema({
  paye: { type: Number, default: 0, min: 0 },
  nssf: { type: Number, default: 0, min: 0 },
  shif: { type: Number, default: 0, min: 0 },
  housingLevy: { type: Number, default: 0, min: 0 },
  loans: { type: Number, default: 0, min: 0 }
}, { _id: false });

const payrollSchema = new Schema({
  staffId: {
    type: Schema.Types.ObjectId,
    ref: 'Staff',
    required: true,
    index: true
  },
  payPeriod: {
    type: String,
    required: true,
    index: true
  },
  basicSalary: {
    type: Number,
    required: true,
    min: 0
  },
  allowances: {
    type: Number,
    default: 0,
    min: 0
  },
  grossSalary: {
    type: Number,
    required: true,
    min: 0
  },
  deductions: {
    type: payrollDeductionsSchema,
    required: true
  },
  totalDeductions: {
    type: Number,
    required: true,
    min: 0
  },
  netSalary: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['draft', 'processed', 'approved', 'paid'],
    default: 'draft'
  },
  payslipRef: {
    type: String,
    required: true
  },
  paymentDate: {
    type: Date
  }
}, {
  timestamps: true
});

payrollSchema.index({ payPeriod: 1, staffId: 1 }, { unique: true });

const Payroll = mongoose.model('Payroll', payrollSchema);
export default Payroll;
