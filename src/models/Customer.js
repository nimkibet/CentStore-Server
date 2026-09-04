import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  email: { type: String, lowercase: true, trim: true, default: '' },
  address: { type: String, trim: true, default: '' },
  totalSpent: { type: Number, default: 0 },
  purchaseCount: { type: Number, default: 0 },
  tags: { type: [String], default: [] },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  lastPurchaseDate: { type: Date }
}, { timestamps: true });

const Customer = mongoose.model('Customer', customerSchema);
export default Customer;
