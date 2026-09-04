import IMEIRecord from '../models/IMEIRecord.js';
import Customer from '../models/Customer.js';
import { generateReceiptPDF } from '../utils/pdfGenerator.js';
import { createPOSSaleJournalEntry } from '../services/autoAccounting.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Staff from '../models/Staff.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set.');
  process.exit(1);
}

// Helper to generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' });
};

// --- STAFF AUTH & MANAGEMENT ---

// Login Staff
export const loginStaff = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

    const staff = await Staff.findOne({ email: email.toLowerCase().trim() });
    if (!staff) {
      return res.status(401).json({ error: 'Invalid staff credentials' });
    }

    const isMatch = await staff.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid staff credentials' });
    }

    if (staff.status !== 'active') {
      return res.status(403).json({ error: 'Staff account is deactivated. Contact CEO.' });
    }

    const token = generateToken(staff._id);

    res.json({
      token,
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        phone: staff.phone
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Staff login failed: ' + err.message });
  }
};

// Get current logged-in staff profile
export const getStaffProfile = async (req, res) => {
  try {
    res.json(req.staff);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch staff profile: ' + err.message });
  }
};

// Get all staff members (CEO only)
export const getAllStaff = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip  = (page - 1) * limit;
    const [staffList, total] = await Promise.all([
      Staff.find({}).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Staff.countDocuments({})
    ]);
    res.json({ data: staffList, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch staff list: ' + err.message });
  }
};


// Register new staff member (CEO only)
export const createStaff = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required' });
    }

    const validRoles = ['CEO', 'Finance', 'Cashier', 'WebAdmin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const existing = await Staff.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ error: 'Staff member with this email already exists' });
    }

    const newStaff = new Staff({
      name,
      email: email.toLowerCase().trim(),
      password,
      role,
      phone: phone || ''
    });

    await newStaff.save();

    res.status(201).json({
      message: 'Staff account created successfully',
      staff: {
        id: newStaff._id,
        name: newStaff.name,
        email: newStaff.email,
        role: newStaff.role,
        phone: newStaff.phone,
        status: newStaff.status
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create staff account: ' + err.message });
  }
};

// Update staff status or role (CEO only)
export const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, status, phone, name } = req.body;

    const staff = await Staff.findById(id);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    if (role) {
      const validRoles = ['CEO', 'Finance', 'Cashier', 'WebAdmin'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role specified' });
      }
      staff.role = role;
    }

    if (status) staff.status = status;
    if (phone !== undefined) staff.phone = phone;
    if (name) staff.name = name;

    await staff.save();

    res.json({
      message: 'Staff updated successfully',
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        phone: staff.phone,
        status: staff.status
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update staff member: ' + err.message });
  }
};

// Delete staff member (CEO only)
export const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.staff._id.toString() === id) {
      return res.status(400).json({ error: 'Cannot delete your own active CEO account' });
    }

    const deleted = await Staff.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    res.json({ message: 'Staff member deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete staff member: ' + err.message });
  }
};

// --- INVENTORY MANAGEMENT (Product CRUD) ---

// Get all products
export const getErpProducts = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip  = (page - 1) * limit;
    const [products, total] = await Promise.all([
      Product.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Product.countDocuments({})
    ]);
    res.json({ data: products, pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page < Math.ceil(total / limit), hasPrev: page > 1 } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inventory: ' + err.message });
  }
};


// Create product (CEO, WebAdmin) - Trial limit middleware checked before this
export const createErpProduct = async (req, res) => {
  try {
    const { title, price, originalPrice, brand, category, storage, stock, description, imageUrl } = req.body;
    let finalImageUrl = imageUrl || '/products/iphone17.jpg';

    // If an image was uploaded via Cloudinary middleware
    if (req.file) {
      finalImageUrl = req.file.path || req.file.secure_url || `/uploads/${req.file.filename}`;
    }

    const numPrice = Number(price) || 0;
    const numOriginal = Number(originalPrice) || numPrice;
    const discountPercentage = numOriginal > 0 ? Math.round(((numOriginal - numPrice) / numOriginal) * 100) : 0;

    const newProduct = new Product({
      id: Date.now(),
      title: title || 'New Product',
      name: title || 'New Product',
      price: numPrice,
      originalPrice: numOriginal,
      discountPercentage,
      brand: brand || 'Generic',
      category: category || 'Premium Accessories',
      storage: storage || 'Standard',
      stock: Number(stock) || 10,
      description: description || '',
      imageUrl: finalImageUrl,
      images: [finalImageUrl],
      status: 'active'
    });

    const saved = await newProduct.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create product: ' + err.message });
  }
};

// Update product (CEO, WebAdmin)
export const updateErpProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (req.file) {
      updates.imageUrl = req.file.path || req.file.secure_url || `/uploads/${req.file.filename}`;
    }

    if (updates.price !== undefined || updates.originalPrice !== undefined) {
      const existingProduct = await Product.findOne({ $or: [{ _id: id }, { id: Number(id) }] });
      if (existingProduct) {
        const price = updates.price !== undefined ? Number(updates.price) : existingProduct.price;
        const originalPrice = updates.originalPrice !== undefined ? Number(updates.originalPrice) : existingProduct.originalPrice;
        updates.discountPercentage = originalPrice > 0 ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
      }
    }

    let updatedProduct;
    if (mongoose.Types.ObjectId.isValid(id)) {
      updatedProduct = await Product.findByIdAndUpdate(id, updates, { new: true });
    } else {
      updatedProduct = await Product.findOneAndUpdate({ id: Number(id) }, updates, { new: true });
    }

    if (!updatedProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(updatedProduct);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product: ' + err.message });
  }
};

// Delete product (CEO, WebAdmin)
export const deleteErpProduct = async (req, res) => {
  try {
    const { id } = req.params;
    let deleted;
    if (mongoose.Types.ObjectId.isValid(id)) {
      deleted = await Product.findByIdAndDelete(id);
    } else {
      deleted = await Product.findOneAndDelete({ id: Number(id) });
    }

    if (!deleted) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deleted from database successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product: ' + err.message });
  }
};

// --- POS SALES PROCESSING (CEO, Cashier) ---
export const createPOSSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { items, paymentMethod, customerName, customerPhone } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ error: 'POS sale must contain at least one item' });
    }
    let totalAmount = 0;
    const orderItems = [];
    for (const item of items) {
      const dbProduct = await Product.findOne({ $or: [{ id: item.productId }, { _id: item.productId }] }, null, { session });
      if (!dbProduct) {
        await session.abortTransaction(); session.endSession();
        return res.status(404).json({ error: `Product ID ${item.productId} not found` });
      }
      const qty = Number(item.quantity) || 1;
      if (dbProduct.stock < qty) {
        await session.abortTransaction(); session.endSession();
        return res.status(400).json({ error: `Insufficient stock for "${dbProduct.title}". Requested: ${qty}, Available: ${dbProduct.stock}` });
      }
      
        if (item.imeis && Array.isArray(item.imeis)) {
          for (const imeiStr of item.imeis) {
            await IMEIRecord.findOneAndUpdate(
              { imei: imeiStr, productId: dbProduct._id },
              { $set: { status: 'sold', soldAt: new Date() } },
              { session }
            );
          }
        }
        
        dbProduct.stock -= qty;
      dbProduct.sold = (dbProduct.sold || 0) + qty;
      await dbProduct.save({ session });
      totalAmount += dbProduct.price * qty;
      orderItems.push({ productId: dbProduct.id, productRef: dbProduct._id, title: dbProduct.title, price: dbProduct.price, quantity: qty, storage: dbProduct.storage || 'Standard' });
    }
    
    if (customerPhone && customerPhone !== 'N/A') {
      await Customer.findOneAndUpdate(
        { phone: customerPhone },
        { 
          $set: { name: customerName || 'Walk-in Customer' },
          $inc: { totalSpent: totalAmount, purchaseCount: 1 },
          $set: { lastPurchaseDate: new Date() }
        },
        { upsert: true, new: true, session }
      );
    }
    
    const posOrder = new Order({
      createdByStaff: req.staff._id, origin: 'POS', items: orderItems, totalAmount,
      paymentMethod: paymentMethod || 'cash',
      shippingAddress: { name: customerName || 'Walk-in Customer', phone: customerPhone || 'N/A', address: 'POS Counter Sale', city: 'Nairobi', country: 'Kenya' },
      status: 'delivered', isPaid: true, paidAt: new Date()
    });
    const savedOrder = await posOrder.save({ session });
    // Trigger Auto-Accounting GL Entry (Fire & Forget)
    createPOSSaleJournalEntry({ orderId: savedOrder._id, totalAmount: savedOrder.totalAmount, cashierName: req.staff.name });
    await session.commitTransaction();
    session.endSession();
    res.status(201).json({
      message: 'POS sale processed successfully. Inventory updated.',
      order: { id: `#POS-${savedOrder._id.toString().slice(-6).toUpperCase()}`, receiptId: savedOrder._id, origin: savedOrder.origin, totalAmount: savedOrder.totalAmount, paymentMethod: savedOrder.paymentMethod, items: savedOrder.items, cashier: req.staff.name, createdAt: savedOrder.createdAt }
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: 'Failed to process POS sale: ' + err.message });
  }
};


// --- ONLINE & POS ORDERS FEED ---
export const getErpOrders = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip  = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      Order.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('createdByStaff', 'name role'),
      Order.countDocuments({})
    ]);
    const formattedOrders = orders.map(o => ({
      _id: o._id,
      orderNumber: o.origin === 'POS' ? `#POS-${o._id.toString().slice(-6).toUpperCase()}` : `#CS-${o._id.toString().slice(-6).toUpperCase()}`,
      origin: o.origin || 'Website',
      customerName: o.shippingAddress?.name || o.guestEmail || 'Cent Customer',
      customerEmail: o.guestEmail || 'customer@centstores.co.ke',
      customerPhone: o.shippingAddress?.phone || 'N/A',
      itemsCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
      itemsList: o.items.map(i => `${i.title} (x${i.quantity})`),
      totalAmount: o.totalAmount,
      paymentMethod: o.paymentMethod,
      status: o.status,
      isPaid: o.isPaid,
      createdByName: o.createdByStaff ? o.createdByStaff.name : 'System / Website',
      createdAt: o.createdAt
    }));
    res.json({ data: formattedOrders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders: ' + err.message });
  }
};


// Update order status (CEO, WebAdmin)
export const updateErpOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    order.status = status;
    if (status === 'delivered') {
      order.isPaid = true;
      if (!order.paidAt) order.paidAt = new Date();
    }

    await order.save();

    res.json({ message: 'Order status updated successfully', order });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order status: ' + err.message });
  }
};

// --- REPORTS & FINANCIAL SUMMARY (CEO, Finance) ---
export const getErpReports = async (req, res) => {
  try {
    const allOrders = await Order.find({});
    const totalRevenue = allOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const websiteOrdersCount = allOrders.filter(o => o.origin === 'Website' || !o.origin).length;
    const posOrdersCount = allOrders.filter(o => o.origin === 'POS').length;

    const allProducts = await Product.find({});
    const lowStockAlerts = allProducts.filter(p => (p.stock || 0) < 5);

    res.json({
      totalRevenue,
      totalOrders: allOrders.length,
      websiteOrdersCount,
      posOrdersCount,
      totalProductsCount: allProducts.length,
      lowStockAlertsCount: lowStockAlerts.length,
      lowStockProducts: lowStockAlerts.map(p => ({
        id: p._id,
        title: p.title,
        stock: p.stock,
        price: p.price
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate financial reports: ' + err.message });
  }
};

export const downloadPOSReceipt = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('createdByStaff', 'name');
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const formattedOrder = {
      orderNumber: order.origin === 'POS' ? `#POS-${order._id.toString().slice(-6).toUpperCase()}` : `#CS-${order._id.toString().slice(-6).toUpperCase()}`,
      createdAt: order.createdAt,
      createdByName: order.createdByStaff ? order.createdByStaff.name : 'System',
      customerName: order.shippingAddress?.name || 'Walk-in Customer',
      itemsList: order.items.map(i => `${i.title} (x${i.quantity}) - KSh ${i.price * i.quantity}`),
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod
    };
    const pdfBuffer = await generateReceiptPDF(formattedOrder);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Receipt_${formattedOrder.orderNumber}.pdf"`,
      'Content-Length': pdfBuffer.length
    });
    res.end(pdfBuffer);
  } catch (err) { res.status(500).json({ error: 'Failed to generate receipt: ' + err.message }); }
};
