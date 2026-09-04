import mongoose from 'mongoose';

const imeiSchema = new mongoose.Schema({
  imei: { type: String, required: true, unique: true, trim: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  status: { type: String, enum: ['in_stock', 'sold', 'rma'], default: 'in_stock' },
  addedAt: { type: Date, default: Date.now },
  soldAt: { type: Date },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' }
});

const IMEIRecord = mongoose.model('IMEIRecord', imeiSchema);
export default IMEIRecord;
