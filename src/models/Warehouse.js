import mongoose, { Schema } from 'mongoose';

const warehouseProductSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, default: 0 },
  reorderPoint: { type: Number, default: 5 }
}, { _id: false });

const warehouseSchema = new Schema({
  code: {
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
  location: {
    address: { type: String, default: '' },
    city: { type: String, default: 'Nairobi' },
    country: { type: String, default: 'Kenya' }
  },
  contactPerson: {
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' }
  },
  capacity: { type: Number, default: 10000 },
  manager: { type: String, default: '' },
  isDefault: { type: Boolean, default: false },
  products: [warehouseProductSchema],
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active'
  }
}, {
  timestamps: true
});

warehouseSchema.index({ code: 1 });
warehouseSchema.index({ status: 1 });

const Warehouse = mongoose.model('Warehouse', warehouseSchema);
export default Warehouse;
