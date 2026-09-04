import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import Product from './src/models/Product.js';
import Order from './src/models/Order.js';
import Staff from './src/models/Staff.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('Error: MONGO_URI is not defined in .env file.');
  process.exit(1);
}

const resetTrialDatabase = async () => {
  try {
    console.log('Connecting to MongoDB for 12-hour trial reset...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');

    // 1. Clear Orders collection
    await Order.deleteMany({});
    console.log('Cleared all Order entries.');

    // 2. Clear non-admin Staff accounts (Keep CEO admin account)
    await Staff.deleteMany({ role: { $ne: 'CEO' } });
    console.log('Cleared temporary staff accounts. Retained CEO admin account.');

    // Ensure default staff accounts exist for each role
    const defaultStaff = [
      { name: 'CEO Executive', email: 'ceo@centstore.com', password: 'ceo123', role: 'CEO', phone: '+254700000001' },
      { name: 'Finance Lead', email: 'finance@centstore.com', password: 'finance123', role: 'Finance', phone: '+254700000002' },
      { name: 'Head Cashier', email: 'cashier@centstore.com', password: 'cashier123', role: 'Cashier', phone: '+254700000003' },
      { name: 'Web Administrator', email: 'webadmin@centstore.com', password: 'webadmin123', role: 'WebAdmin', phone: '+254700000004' }
    ];

    for (const staffMember of defaultStaff) {
      const exists = await Staff.findOne({ email: staffMember.email });
      if (!exists) {
        await Staff.create(staffMember);
        console.log(`Created default ${staffMember.role} staff account: ${staffMember.email}`);
      }
    }

    // 3. Reset Product inventory pool to baseline 5 products (within < 10 trial limit)
    await Product.deleteMany({});
    console.log('Reset Product inventory collection.');

    const defaultTrialProducts = [
      {
        id: 101,
        title: "Apple MacBook Pro 16 M3 Max",
        price: 345000,
        originalPrice: 380000,
        discountPercentage: 9,
        rating: 5.0,
        imageUrl: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80",
        brand: "Apple",
        category: "Laptops & Computers",
        storage: "1TB SSD",
        stock: 8,
        description: "M3 Max with 16-core CPU and 40-core GPU, 48GB unified memory for ultra pro workflows.",
        status: "active"
      },
      {
        id: 102,
        title: "Dell XPS 15 9530 Touch",
        price: 215000,
        originalPrice: 240000,
        discountPercentage: 10,
        rating: 4.8,
        imageUrl: "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=800&auto=format&fit=crop&q=80",
        brand: "Dell",
        category: "Laptops & Computers",
        storage: "512GB SSD",
        stock: 5,
        description: "15.6 inch OLED 3.5K touch screen powered by 13th Gen Intel Core i9.",
        status: "active"
      },
      {
        id: 103,
        title: "iPhone 16 Pro Max 256GB",
        price: 185000,
        originalPrice: 195000,
        discountPercentage: 5,
        rating: 4.9,
        imageUrl: "/products/iphone17.jpg",
        brand: "Apple",
        category: "Smartphones",
        storage: "256GB",
        stock: 12,
        description: "Titanium design, A18 Pro chip, 48MP Fusion camera system.",
        status: "active"
      },
      {
        id: 104,
        title: "Sony WH-1000XM5 Wireless Headphones",
        price: 45000,
        originalPrice: 52000,
        discountPercentage: 13,
        rating: 4.9,
        imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
        brand: "Sony",
        category: "Audio & Accessories",
        storage: "Standard",
        stock: 15,
        description: "Industry-leading noise canceling headphones with two processors and 8 microphones.",
        status: "active"
      },
      {
        id: 105,
        title: "Samsung Galaxy Tab S9 Ultra",
        price: 135000,
        originalPrice: 150000,
        discountPercentage: 10,
        rating: 4.7,
        imageUrl: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&auto=format&fit=crop&q=80",
        brand: "Samsung",
        category: "Tablets",
        storage: "256GB",
        stock: 4,
        description: "14.6 inch Dynamic AMOLED 2X display, S Pen included, IP68 water resistance.",
        status: "active"
      }
    ];

    await Product.insertMany(defaultTrialProducts);
    console.log('Seeded 5 initial products into trial inventory.');

    console.log('Trial database reset completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error during trial database reset:', err);
    process.exit(1);
  }
};

resetTrialDatabase();
