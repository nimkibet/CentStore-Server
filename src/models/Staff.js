import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const bankDetailsSchema = new mongoose.Schema({
  bankName:      { type: String, trim: true, default: '' },
  accountNumber: { type: String, trim: true, default: '' },
  bankCode:      { type: String, trim: true, default: '' },
  branch:        { type: String, trim: true, default: '' }
}, { _id: false });

const emergencyContactSchema = new mongoose.Schema({
  name:         { type: String, trim: true, default: '' },
  relationship: { type: String, trim: true, default: '' },
  phone:        { type: String, trim: true, default: '' }
}, { _id: false });

const staffSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role:     { type: String, required: true, trim: true },
  permissions:      { type: [String], default: [] },
  phone:            { type: String, trim: true, default: '' },
  status:           { type: String, enum: ['active', 'inactive'], default: 'active' },
  department:       { type: String, trim: true, default: 'General' },
  position:         { type: String, trim: true, default: 'Staff' },
  employmentStatus: { type: String, enum: ['full_time', 'part_time', 'contract', 'intern', 'terminated'], default: 'full_time' },
  basicSalary:         { type: Number, default: 0, min: 0 },
  allowances:          { type: Number, default: 0, min: 0 },
  statutoryDeductions: { type: Number, default: 0, min: 0 },
  bankDetails:       { type: bankDetailsSchema, default: () => ({}) },
  emergencyContacts: { type: [emergencyContactSchema], default: [] },
  hireDate:    { type: Date, default: Date.now },
  taxId:       { type: String, trim: true, default: '' },
  nhifNumber:  { type: String, trim: true, default: '' },
  nssfNumber:  { type: String, trim: true, default: '' }
}, { timestamps: true });

staffSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) { next(err); }
});

staffSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const Staff = mongoose.model('Staff', staffSchema);
export default Staff;
