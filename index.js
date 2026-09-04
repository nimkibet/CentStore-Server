import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';

// DB Config and Models
import connectDB from './src/config/db.js';
import Product from './src/models/Product.js';
import Setting from './src/models/Setting.js';
import User from './src/models/User.js';
import Order from './src/models/Order.js';
import Staff from './src/models/Staff.js';
import erpRoutes from './src/routes/erpRoutes.js';
import scmRoutes from './src/routes/scmRoutes.js';
import fmsRoutes from './src/routes/fmsRoutes.js';
import hcmRoutes from './src/routes/hcmRoutes.js';
import customerRoutes from './src/routes/customerRoutes.js';

import { initScmEventListeners } from './src/services/scmService.js';
import { runSeeder } from './seeder_with_cloudinary.js';

// Auth controllers
import { register, verifyOTP, login, googleLogin } from './src/controllers/authController.js';
import { globalLimiter, authLimiter } from './src/middleware/rateLimiter.js';
import upload from './src/middleware/upload.js';
import { Groq } from 'groq-sdk';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'products.json');

// Ensure local uploads directory exists
if (!fs.existsSync('./public/uploads')) {
  fs.mkdirSync('./public/uploads', { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 5000;

// Security and utility middlewares
app.use(helmet({
  contentSecurityPolicy: false // Allow loading assets from external sources in dev
}));

// Request logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Origin: ${req.headers.origin || 'No Origin'}`);
  next();
});

const rawFrontendUrl = process.env.FRONTEND_URL || 'https://cent-stores.vercel.app';
const cleanFrontendUrl = rawFrontendUrl.endsWith('/') ? rawFrontendUrl.slice(0, -1) : rawFrontendUrl;

const allowedOrigins = [
  cleanFrontendUrl,
  'https://cent-stores.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.includes(origin) || 
                      origin.endsWith('.vercel.app');
                      
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`[CORS Blocked] Origin: ${origin} not allowed`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(globalLimiter);
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Database connection
connectDB().then(() => {
  seedDatabase();
  initScmEventListeners();
});

// Seeder logic for Mongo
const seedDatabase = async () => {
  try {
    // 1. Seed Products if empty
    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      console.log('MongoDB products collection is empty. Executing Cloudinary product seeder...');
      await runSeeder();
    }

    // 2. Seed Default Settings if empty
    const settingsCount = await Setting.countDocuments();
    if (settingsCount === 0) {
      console.log('MongoDB settings collection is empty. Seeding default settings...');
      const defaultSettings = [
        { key: 'usdToKesRate', value: 130, description: 'USD to KES Exchange Rate' },
        { key: 'overlayOpacity', value: 40, description: 'Storefront Hero Banner Overlay Opacity (0-100)' },
        { key: 'sectionHeight', value: 368, description: 'Storefront Hero Banner Height (px)' },
        { key: 'heroSlides', value: [
          {
            id: 1,
            title: "Next-Gen Apple iPhone 17 Series",
            subtitle: "Physical SIM & eSIM Only editions now in stock. Experience the future of mobile technology today.",
            tag: "NOW IN STOCK",
            badge: "KSh 112,000 Key Starting",
            imageUrl: "/products/iphone17.jpg",
            buttonText: "Browse iPhones"
          },
          {
            id: 2,
            title: "OnePlus & Redmi Flagships",
            subtitle: "Supercharged performance with OnePlus 15 5G and Redmi Note 15 Pro. Smooth rates at unbeatable value.",
            tag: "REDMI / ONEPLUS SPECIAL",
            badge: "KSh 16,000 Key Starting",
            imageUrl: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=1200&auto=format&fit=crop&q=80",
            buttonText: "View Price Lists"
          },
          {
            id: 3,
            title: "Samsung Galaxy AI Innovations",
            subtitle: "Galaxy S24 Ultra, Z Fold 6, and Z Flip 6. Reshape your reality with next-level mobile intelligence.",
            tag: "GALAXY SHOWCASE",
            badge: "UP TO 15% OFF",
            imageUrl: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=1200&auto=format&fit=crop&q=80",
            buttonText: "Explore Galaxy Devices"
          }
        ], description: 'Homepage Slideshow List' }
      ];
      await Setting.insertMany(defaultSettings);
      console.log('Seeded default storefront configuration.');
    }

    // 3. Seed Default Admin if none exists
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      console.log('Seeding default administrator profile...');
      await User.create({
        name: 'Executive Admin',
        email: 'admin@centstores.co.ke',
        password: 'admin123',
        role: 'admin',
        isActive: true,
        authProvider: 'local'
      });
      console.log('Seeded default admin credentials.');
    }

    // Seed specific administrator profile nimrodkibet376@gmail.com
    const specificAdminExists = await User.findOne({ email: 'nimrodkibet376@gmail.com' });
    if (!specificAdminExists) {
      console.log('Seeding specific administrator profile nimrodkibet376@gmail.com...');
      await User.create({
        name: 'Nimrod Kibet',
        email: 'nimrodkibet376@gmail.com',
        password: 'Nimrod123',
        role: 'admin',
        isActive: true,
        authProvider: 'local'
      });
    }
    // 4. Seed Default Staff Profiles for ERP if empty
    const staffCount = await Staff.countDocuments();
    if (staffCount === 0) {
      console.log('Seeding default ERP staff accounts for all roles...');
      const defaultStaffList = [
        { name: 'CEO Executive', email: 'ceo@centstore.com', password: 'ceo123', role: 'CEO', phone: '+254700000001' },
        { name: 'Finance Manager', email: 'finance@centstore.com', password: 'finance123', role: 'Finance', phone: '+254700000002' },
        { name: 'Lead Cashier', email: 'cashier@centstore.com', password: 'cashier123', role: 'Cashier', phone: '+254700000003' },
        { name: 'Web Administrator', email: 'webadmin@centstore.com', password: 'webadmin123', role: 'WebAdmin', phone: '+254700000004' }
      ];
      for (const s of defaultStaffList) {
        await Staff.create(s);
      }
      console.log('Seeded default ERP staff credentials.');
    }
  } catch (err) {
    console.error('Database seeding error:', err);
  }
};

// Health check endpoints
app.get('/', (req, res) => {
  res.status(200).json({ status: 'healthy', message: 'Cent Store Backend API is running' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// --- ERP API ROUTES ---
app.use('/api/erp', erpRoutes);
app.use('/api/erp/scm', scmRoutes);
app.use('/api/erp/fms', fmsRoutes);
app.use('/api/erp/finance', fmsRoutes);
app.use('/api/erp/hcm', hcmRoutes);
app.use('/api/erp/customers', customerRoutes);


// --- AUTHENTICATION API ROUTES ---
app.post('/api/auth/register', authLimiter, register);
app.post('/api/auth/verify-otp', authLimiter, verifyOTP);
app.post('/api/auth/login', authLimiter, login);
app.post('/api/auth/google', googleLogin);

// --- PRODUCTS API ROUTES (MongoDB backed) ---
// GET: Fetch all products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find({ status: 'active' }).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products: ' + err.message });
  }
});

// POST: Add new product
app.post('/api/products', async (req, res) => {
  try {
    const price = Number(req.body.price) || 0;
    const originalPrice = Number(req.body.originalPrice) || price;
    const discountPercentage = originalPrice > 0 ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

    const newProduct = new Product({
      id: req.body.id || Date.now(),
      title: req.body.title || 'Untitled Device',
      price: price,
      originalPrice: originalPrice,
      discountPercentage: discountPercentage,
      rating: Number(req.body.rating) || 5.0,
      imageUrl: req.body.imageUrl || '/products/iphone17.jpg',
      brand: req.body.brand || 'Generic',
      category: req.body.category || 'Premium Accessories',
      storage: req.body.storage || 'Standard',
      note: req.body.note || 'Available',
      isFlashSale: req.body.isFlashSale === true || false,
      description: req.body.description || ''
    });

    const saved = await newProduct.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create product: ' + err.message });
  }
});

// PUT: Update product
app.put('/api/products/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updates = { ...req.body };

    // If price details changed, recalculate discount
    if (req.body.price !== undefined || req.body.originalPrice !== undefined) {
      const dbProduct = await Product.findOne({ id });
      if (dbProduct) {
        const price = req.body.price !== undefined ? Number(req.body.price) : dbProduct.price;
        const originalPrice = req.body.originalPrice !== undefined ? Number(req.body.originalPrice) : dbProduct.originalPrice;
        updates.discountPercentage = originalPrice > 0 ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
      }
    }

    const updated = await Product.findOneAndUpdate({ id }, updates, { new: true });
    if (!updated) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product: ' + err.message });
  }
});

// DELETE: Delete product (soft-delete by marking inactive or hard-delete)
app.delete('/api/products/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const deleted = await Product.findOneAndDelete({ id });
    if (!deleted) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    res.json({ message: 'Product successfully deleted from MongoDB.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product: ' + err.message });
  }
});

// --- SETTINGS CONFIGURATION API ROUTES ---
// GET: Fetch all settings keys
app.get('/api/settings', async (req, res) => {
  try {
    const settingsList = await Setting.find({});
    const settingsObj = {};
    settingsList.forEach(s => {
      settingsObj[s.key] = s.value;
    });
    res.json(settingsObj);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve website settings: ' + err.message });
  }
});

// POST: Save website settings
app.post('/api/settings', async (req, res) => {
  try {
    const settingsObj = req.body; // Expects key-value pairs
    for (const [key, value] of Object.entries(settingsObj)) {
      await Setting.findOneAndUpdate(
        { key },
        { key, value },
        { upsert: true, new: true }
      );
    }
    res.json({ message: 'Website settings saved and synchronized successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings: ' + err.message });
  }
});

// --- MEDIA FILE UPLOADER ENDPOINT ---
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please supply a file upload payload.' });
  }
  let imageUrl = req.file.path || req.file.secure_url || `/uploads/${req.file.filename}`;
  // Normalize local file paths to a web-friendly path starting with /uploads/
  if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('/uploads')) {
    imageUrl = imageUrl.replace(/^(\.?\/?)public\/uploads\/?/, '/uploads/');
    imageUrl = imageUrl.replace(/\\/g, '/');
    if (!imageUrl.startsWith('/uploads/')) {
      imageUrl = '/uploads/' + imageUrl;
    }
  }
  res.status(200).json({ imageUrl });
});

// --- GROQ AI PRODUCT DESCRIPTION GENERATOR ---
app.post('/api/ai/generate-description', async (req, res) => {
  const { title, brand, category, storage } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Product title is required' });
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    // Fallback if no GROQ api key provided
    const fallbackDesc = `Experience the next level of technology with the all-new ${title}. Engineered by ${brand || 'premium design'} to deliver peak performance, this device features an advanced display, elite processing speeds, and state-of-the-art camera capabilities. Perfect for professional workflows and daily high-demand tasks. Available in ${storage || 'Standard'} configuration, exclusively imported and certified by Cent Store Kenya.`;
    return res.json({ description: fallbackDesc, note: 'Generated using local fallback (GROQ_API_KEY is not configured)' });
  }

  try {
    const groq = new Groq({ apiKey: groqApiKey });
    const prompt = `Write a premium, attractive, and professional e-commerce product description for the following product:
Name: ${title}
Brand: ${brand || 'Unknown'}
Category: ${category || 'Electronics'}
Storage/Configuration: ${storage || 'Standard'}

Make it detailed (2-3 sentences), highlighting performance, display, and camera/professional use. Keep it focused on Kenyan premium tech buyers (Cent Store Kenya). Do not include any meta-text, introductions like "Here is...", or bullet points. Just return the paragraph of the description.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama3-8b-8192',
    });

    const description = chatCompletion.choices[0]?.message?.content?.trim();
    res.json({ description });
  } catch (error) {
    console.error('Groq AI generation error:', error);
    res.status(500).json({ error: 'Failed to generate description: ' + error.message });
  }
});

// --- USERS MANAGEMENT API ROUTES ---
// GET: Fetch all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users: ' + err.message });
  }
});

// POST: Add user
app.post('/api/users', async (req, res) => {
  try {
    const { name, email, role, password } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: 'User already exists' });
    }
    const newUser = await User.create({
      name,
      email,
      role: role || 'user',
      password: password || '123456',
      isActive: true,
      authProvider: 'local'
    });
    res.status(201).json(newUser);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create user: ' + err.message });
  }
});

// PUT: Update user role
app.put('/api/users/:email/role', async (req, res) => {
  try {
    const { role } = req.body;
    const updated = await User.findOneAndUpdate(
      { email: req.params.email },
      { role },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user role: ' + err.message });
  }
});

// DELETE: Delete user
app.delete('/api/users/:email', async (req, res) => {
  try {
    await User.findOneAndDelete({ email: req.params.email });
    res.json({ message: 'User successfully deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user: ' + err.message });
  }
});

// --- ORDERS API ROUTES ---
// GET: Fetch all orders
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 });
    const mappedOrders = orders.map(o => ({
      id: `#CS-${o._id.toString().slice(-6).toUpperCase()}`,
      customerName: o.shippingAddress?.name || o.guestEmail || 'Cent Customer',
      customerEmail: o.guestEmail || 'customer@centstores.co.ke',
      customerPhone: o.shippingAddress?.phone || '+254711000000',
      itemsCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
      itemsList: o.items.map(i => `${i.title} (${i.storage || 'Standard'})`),
      total: o.totalAmount,
      status: o.status === 'delivered' || o.status === 'processing' ? 'Fulfilled' : 'Pending',
      date: new Date(o.createdAt).toISOString().split('T')[0]
    }));
    res.json(mappedOrders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders: ' + err.message });
  }
});

// POST: Add new order
app.post('/api/orders', async (req, res) => {
  try {
    const { items, totalAmount, paymentMethod, shippingAddress, guestEmail } = req.body;
    const newOrder = new Order({
      items: items.map(i => ({
        productId: i.productId,
        title: i.title,
        price: i.price,
        quantity: i.quantity,
        storage: i.storage || 'Standard'
      })),
      totalAmount,
      paymentMethod: paymentMethod || 'whatsapp',
      shippingAddress,
      guestEmail: guestEmail || 'customer@centstores.co.ke',
      status: 'pending',
      isPaid: false
    });
    const saved = await newOrder.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create order: ' + err.message });
  }
});

// PUT: Update order status
app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const cleanId = req.params.id;
    if (cleanId.startsWith('#CS-')) {
      const suffix = cleanId.substring(4).toLowerCase();
      const orders = await Order.find({});
      const targetOrder = orders.find(o => o._id.toString().slice(-6).toLowerCase() === suffix);
      if (targetOrder) {
        targetOrder.status = status === 'Fulfilled' ? 'delivered' : 'pending';
        await targetOrder.save();
        return res.json({ message: 'Order status updated successfully.' });
      }
      return res.status(404).json({ error: 'Order not found.' });
    }
    const updated = await Order.findByIdAndUpdate(cleanId, { status: status === 'Fulfilled' ? 'delivered' : 'pending' }, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order status: ' + err.message });
  }
});

const ports = new Set([
  parseInt(PORT),
  5000,
  3000,
  8080
].filter(Boolean));

ports.forEach((p) => {
  try {
    const server = app.listen(p, '0.0.0.0', () => {
      console.log(`Backend server is running on http://0.0.0.0:${p}`);
    });
    server.on('error', (err) => {
      console.warn(`Could not listen on port ${p}: ${err.message}`);
    });
  } catch (err) {
    console.warn(`Failed to start server on port ${p}: ${err.message}`);
  }
});
