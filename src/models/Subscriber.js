import mongoose from 'mongoose';

const subscriberSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['subscribed', 'unsubscribed'],
    default: 'subscribed'
  }
}, {
  timestamps: true
});

const Subscriber = mongoose.model('Subscriber', subscriberSchema);
export default Subscriber;
