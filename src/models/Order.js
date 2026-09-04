import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // can be null for guest checkouts & POS sales
  },
  createdByStaff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: false
  },
  isGuestCheckout: {
    type: Boolean,
    default: false
  },
  guestEmail: {
    type: String,
    lowercase: true,
    trim: true
  },
  origin: {
    type: String,
    enum: ['Website', 'POS'],
    default: 'Website'
  },
  items: [
    {
      productId: {
        type: Number, // matching numeric product ID
        required: true
      },
      productRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      title: String,
      price: Number,
      quantity: Number,
      size: String,
      color: String,
      storage: String
    }
  ],
  totalAmount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['mpesa', 'paystack', 'flutterwave', 'whatsapp', 'cod', 'cash', 'card', 'pos_cash', 'pos_card'],
    required: true
  },
  shippingAddress: {
    name: String,
    phone: String,
    address: String,
    city: String,
    country: String
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'failed'],
    default: 'pending'
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  paidAt: Date,
  mpesaCheckoutRequestId: {
    type: String,
    sparse: true
  },
  paystackReference: {
    type: String,
    sparse: true
  },
  flutterwaveTransactionId: {
    type: String,
    sparse: true
  }
}, {
  timestamps: true
});

orderSchema.index({ user: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ origin: 1 });

const Order = mongoose.model('Order', orderSchema);
export default Order;
