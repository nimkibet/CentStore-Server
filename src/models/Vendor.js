import mongoose, { Schema } from 'mongoose';

const vendorSchema = new Schema({
  vendorCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  contactName: {
    type: String,
    default: '',
    trim: true
  },
  email: {
    type: String,
    default: '',
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    default: '',
    trim: true
  },
  address: {
    street: { type: String, default: '' },
    city: { type: String, default: 'Nairobi' },
    country: { type: String, default: 'Kenya' }
  },
  taxId: { type: String, default: '' },
  categories: { type: [String], default: [] },
  paymentTerms: {
    type: String,
    enum: ['net15', 'net30', 'net60', 'due_on_receipt'],
    default: 'net30'
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  rating: { type: Number, default: 5, min: 1, max: 5 },
  notes: { type: String, default: '' }
}, {
  timestamps: true
});

vendorSchema.index({ email: 1 });
vendorSchema.index({ status: 1 });

const Vendor = mongoose.model('Vendor', vendorSchema);
export default Vendor;
