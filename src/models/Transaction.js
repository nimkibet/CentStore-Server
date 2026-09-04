import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  userEmail: {
    type: String,
    lowercase: true,
    trim: true
  },
  phoneNumber: String,
  method: {
    type: String,
    enum: ['mpesa', 'paystack', 'flutterwave', 'cod'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending'
  },
  reference: {
    type: String,
    required: true,
    unique: true
  },
  callbackData: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
