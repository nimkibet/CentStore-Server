import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  name: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true
  },
  costPrice: {
    type: Number,
    default: 0
  },
  originalPrice: {
    type: Number
  },
  discountPercentage: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 5.0
  },
  imageUrl: {
    type: String,
    default: '/products/iphone17.jpg'
  },
  images: {
    type: [String],
    default: []
  },
  brand: {
    type: String,
    default: 'Generic'
  },
  category: {
    type: String,
    default: 'Premium Accessories'
  },
  storage: {
    type: String,
    default: 'Standard'
  },
  note: {
    type: String,
    default: 'Available'
  },
  isFlashSale: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'active'
  },
  sizes: {
    type: [String],
    default: []
  },
  colors: {
    type: [String],
    default: []
  },
  stock: {
    type: Number,
    default: 10
  },
  sold: {
    type: Number,
    default: 0
  },
  reviewDetails: {
    rating: { type: Number, default: 5.0 },
    count: { type: Number, default: 0 }
  },
  description: String
}, {
  timestamps: true
});

// Database Indexing for frequently filtered/searched fields
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });
productSchema.index({ isFlashSale: 1 });
productSchema.index({ stock: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ status: 1, stock: 1 });

// Synchronize title and name
productSchema.pre('save', function(next) {
  if (this.title && !this.name) {
    this.name = this.title;
  } else if (this.name && !this.title) {
    this.title = this.name;
  }
  next();
});

const Product = mongoose.model('Product', productSchema);
export default Product;
