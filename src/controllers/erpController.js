import IMEIRecord from '../models/IMEIRecord.js';
import Customer from '../models/Customer.js';
import { generateReceiptPDF } from '../utils/pdfGenerator.js';
import { createPOSSaleJournalEntry } from '../services/autoAccounting.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Staff from '../models/Staff.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { getCache, setCache } from '../config/redis.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __controllerDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__controllerDir, '../../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'centstore_jwt_secret_key_2026_x';

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

    const staffData = {
      id: staff._id,
      _id: staff._id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      permissions: staff.permissions || [],
      department: staff.department,
      phone: staff.phone
    };

    res.json({
      success: true,
      token,
      staff: staffData,
      user: staffData
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

// Get all staff members (CEO and HR)
export const getAllStaff = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip  = (page - 1) * limit;
    const [staffList, total] = await Promise.all([
      Staff.find({}).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Staff.countDocuments({})
    ]);
    res.json({
      success: true,
      data: staffList,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch staff list: ' + err.message });
  }
};


// Register new staff member (CEO and HR)
export const createStaff = async (req, res) => {
  try {
    const { name, email, password, role, phone, permissions, department } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required' });
    }

    const trimmedRole = typeof role === 'string' ? role.trim() : '';
    if (!trimmedRole) {
      return res.status(400).json({ error: 'Role is required and cannot be empty' });
    }

    const existing = await Staff.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ error: 'Staff member with this email already exists' });
    }

    const newStaff = new Staff({
      name,
      email: email.toLowerCase().trim(),
      password,
      role: trimmedRole,
      phone: phone || '',
      permissions: Array.isArray(permissions) ? permissions : (permissions ? [permissions] : []),
      department: department || 'General'
    });

    await newStaff.save();

    res.status(201).json({
      success: true,
      message: 'Staff account created successfully',
      staff: {
        id: newStaff._id,
        _id: newStaff._id,
        name: newStaff.name,
        email: newStaff.email,
        role: newStaff.role,
        permissions: newStaff.permissions,
        phone: newStaff.phone,
        status: newStaff.status
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create staff account: ' + err.message });
  }
};

// Update staff status or role (CEO and HR)
export const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, status, phone, name, permissions, department } = req.body;

    const staff = await Staff.findById(id);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    if (role !== undefined) {
      const trimmedRole = typeof role === 'string' ? role.trim() : '';
      if (!trimmedRole) {
        return res.status(400).json({ error: 'Role cannot be empty' });
      }
      staff.role = trimmedRole;
    }

    if (status) staff.status = status;
    if (phone !== undefined) staff.phone = phone;
    if (name) staff.name = name;
    if (permissions !== undefined) {
      staff.permissions = Array.isArray(permissions) ? permissions : [permissions];
    }
    if (department) staff.department = department;

    await staff.save();

    res.json({
      success: true,
      message: 'Staff updated successfully',
      staff: {
        id: staff._id,
        _id: staff._id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        permissions: staff.permissions,
        phone: staff.phone,
        status: staff.status
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update staff member: ' + err.message });
  }
};

// Delete staff member (CEO and HR)
export const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.staff._id.toString() === id) {
      return res.status(400).json({ error: 'Cannot delete your own active account' });
    }

    const deleted = await Staff.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    res.json({ success: true, message: 'Staff member account deleted successfully' });
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
      stock: req.body.stock !== undefined ? Math.max(0, parseInt(req.body.stock, 10)) : 10,
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

    if (updates.stock !== undefined) {
      updates.stock = Math.max(0, parseInt(updates.stock, 10));
    }

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
  try {
    const { items, paymentMethod, customerName, customerPhone } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'POS sale must contain at least one item' });
    }

    let totalAmount = 0;
    const orderItems = [];
    const stockUpdates = [];

    // Pre-validate all items and check stock levels
    for (const item of items) {
      const prodIdentifier = item.productId || item.product || item.id || item._id;
      if (!prodIdentifier) {
        return res.status(400).json({ error: 'Item missing product ID' });
      }

      let dbProduct = null;
      if (mongoose.isValidObjectId(prodIdentifier)) {
        dbProduct = await Product.findOne({
          $or: [{ _id: prodIdentifier }, { id: isNaN(prodIdentifier) ? null : Number(prodIdentifier) }]
        });
      } else if (!isNaN(prodIdentifier)) {
        dbProduct = await Product.findOne({ id: Number(prodIdentifier) });
      } else {
        dbProduct = await Product.findOne({ id: prodIdentifier });
      }

      if (!dbProduct) {
        return res.status(404).json({ error: `Product ID ${prodIdentifier} not found` });
      }

      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      if (dbProduct.stock < qty) {
        return res.status(400).json({
          error: `Insufficient stock for "${dbProduct.title}". Requested: ${qty}, Available: ${dbProduct.stock}`
        });
      }

      const price = Number(item.price) || dbProduct.price || 0;
      totalAmount += price * qty;

      orderItems.push({
        productId: dbProduct.id,
        productRef: dbProduct._id,
        title: dbProduct.title,
        price,
        quantity: qty,
        storage: dbProduct.storage || 'Standard'
      });

      stockUpdates.push({
        productDoc: dbProduct,
        qty,
        imeis: item.imeis
      });
    }

    // Atomically decrement stock in MongoDB
    const decrementedList = [];
    for (const update of stockUpdates) {
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: update.productDoc._id, stock: { $gte: update.qty } },
        { $inc: { stock: -update.qty, sold: update.qty } },
        { new: true }
      );

      if (!updatedProduct) {
        // Rollback any already decremented items
        for (const done of decrementedList) {
          await Product.findByIdAndUpdate(done.id, { $inc: { stock: done.qty, sold: -done.qty } });
        }
        return res.status(400).json({
          error: `Insufficient stock for "${update.productDoc.title}". Could not complete atomic decrement.`
        });
      }

      decrementedList.push({ id: update.productDoc._id, qty: update.qty });

      if (update.imeis && Array.isArray(update.imeis)) {
        for (const imeiStr of update.imeis) {
          await IMEIRecord.findOneAndUpdate(
            { imei: imeiStr, productId: update.productDoc._id },
            { $set: { status: 'sold', soldAt: new Date() } }
          );
        }
      }
    }

    if (customerPhone && customerPhone !== 'N/A') {
      await Customer.findOneAndUpdate(
        { phone: customerPhone },
        {
          $set: { name: customerName || 'Walk-in Customer' },
          $inc: { totalSpent: totalAmount, purchaseCount: 1 },
          $set: { lastPurchaseDate: new Date() }
        },
        { upsert: true, new: true }
      );
    }

    const posOrder = new Order({
      createdByStaff: req.staff?._id,
      origin: 'POS',
      items: orderItems,
      totalAmount,
      paymentMethod: paymentMethod || 'cash',
      shippingAddress: {
        name: customerName || 'Walk-in Customer',
        phone: customerPhone || 'N/A',
        address: 'POS Counter Sale',
        city: 'Nairobi',
        country: 'Kenya'
      },
      status: 'delivered',
      isPaid: true,
      paidAt: new Date()
    });

    const savedOrder = await posOrder.save();

    // Trigger Auto-Accounting GL Entry (Fire & Forget)
    try {
      createPOSSaleJournalEntry({
        orderId: savedOrder._id,
        totalAmount: savedOrder.totalAmount,
        cashierName: req.staff?.name || 'Cashier'
      });
    } catch {
      // Ignore accounting non-blocking error
    }

    res.status(201).json({
      success: true,
      message: 'POS sale processed successfully. Inventory updated.',
      order: {
        id: `#POS-${savedOrder._id.toString().slice(-6).toUpperCase()}`,
        receiptId: savedOrder._id,
        origin: savedOrder.origin,
        totalAmount: savedOrder.totalAmount,
        paymentMethod: savedOrder.paymentMethod,
        items: savedOrder.items,
        cashier: req.staff?.name || 'Cashier',
        createdAt: savedOrder.createdAt
      }
    });
  } catch (err) {
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
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const period = req.query.period || 'all';
    const skip = (page - 1) * limit;

    const cacheKey = `dashboard:reports:${period}:${page}:${limit}`;

    // 1. Check Redis caching layer (with in-memory fallback)
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      return res.json({
        ...cachedData,
        fromCache: true
      });
    }

    // 2. Build period filter for Orders
    const orderMatch = {};
    const now = new Date();
    if (period === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      orderMatch.createdAt = { $gte: startOfDay };
    } else if (period === '7d' || period === 'week') {
      orderMatch.createdAt = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
    } else if (period === '30d' || period === 'month') {
      orderMatch.createdAt = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    }

    // 3. Execute MongoDB Aggregation Pipelines ($facet)
    const [orderAggregation, productAggregation] = await Promise.all([
      Order.aggregate([
        ...(Object.keys(orderMatch).length ? [{ $match: orderMatch }] : []),
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  totalRevenue: { $sum: '$totalAmount' },
                  totalOrders: { $sum: 1 },
                  websiteOrdersCount: {
                    $sum: { $cond: [{ $or: [{ $eq: ['$origin', 'Website'] }, { $not: ['$origin'] }] }, 1, 0] }
                  },
                  posOrdersCount: {
                    $sum: { $cond: [{ $eq: ['$origin', 'POS'] }, 1, 0] }
                  }
                }
              }
            ],
            paginatedOrders: [
              { $sort: { createdAt: -1 } },
              { $skip: skip },
              { $limit: limit },
              {
                $project: {
                  _id: 1,
                  origin: 1,
                  totalAmount: 1,
                  paymentMethod: 1,
                  status: 1,
                  createdAt: 1,
                  itemsCount: { $size: { $ifNull: ['$items', []] } }
                }
              }
            ],
            topProducts: [
              { $unwind: '$items' },
              {
                $group: {
                  _id: '$items.productId',
                  title: { $first: '$items.title' },
                  totalQuantity: { $sum: '$items.quantity' },
                  totalSales: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
                }
              },
              { $sort: { totalQuantity: -1 } },
              { $limit: 5 }
            ],
            totalCount: [
              { $count: 'count' }
            ]
          }
        }
      ]),
      Product.aggregate([
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  totalProductsCount: { $sum: 1 },
                  totalInventoryStock: { $sum: '$stock' },
                  totalInventoryCost: { $sum: { $multiply: ['$costPrice', '$stock'] } }
                }
              }
            ],
            lowStock: [
              { $match: { stock: { $lt: 5 } } },
              { $sort: { stock: 1 } },
              { $limit: 20 },
              {
                $project: {
                  _id: 1,
                  id: 1,
                  title: 1,
                  stock: 1,
                  price: 1,
                  costPrice: 1
                }
              }
            ],
            lowStockCount: [
              { $match: { stock: { $lt: 5 } } },
              { $count: 'count' }
            ]
          }
        }
      ])
    ]);

    const orderFacet = orderAggregation[0] || {};
    const productFacet = productAggregation[0] || {};

    const orderSummary = orderFacet.summary?.[0] || {};
    const totalRevenue = orderSummary.totalRevenue || 0;
    const totalOrders = orderFacet.totalCount?.[0]?.count || orderSummary.totalOrders || 0;
    const websiteOrdersCount = orderSummary.websiteOrdersCount || 0;
    const posOrdersCount = orderSummary.posOrdersCount || 0;
    const recentOrders = orderFacet.paginatedOrders || [];
    const topProducts = orderFacet.topProducts || [];

    const productSummary = productFacet.summary?.[0] || {};
    const totalProductsCount = productSummary.totalProductsCount || 0;
    const lowStockProducts = (productFacet.lowStock || []).map(p => ({
      id: p._id,
      title: p.title,
      stock: p.stock,
      price: p.price
    }));
    const lowStockAlertsCount = productFacet.lowStockCount?.[0]?.count || lowStockProducts.length;

    const totalCost = productSummary.totalInventoryCost || Math.round(totalRevenue * 0.6);
    const totalProfit = totalRevenue - totalCost;
    const totalPages = Math.ceil(totalOrders / limit) || 1;

    const reportData = {
      success: true,
      fromCache: false,
      totalRevenue,
      totalOrders,
      websiteOrdersCount,
      posOrdersCount,
      totalProductsCount,
      lowStockAlertsCount,
      lowStockProducts,
      totalCost,
      totalProfit,
      kpis: {
        revenue: totalRevenue,
        ordersCount: totalOrders,
        lowStockCount: lowStockAlertsCount
      },
      topProducts,
      recentOrders,
      pagination: {
        page,
        limit,
        total: totalOrders,
        pages: totalPages
      }
    };

    // 4. Save into Redis/memory cache with 300s TTL
    await setCache(cacheKey, reportData, 300);

    res.json(reportData);
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
