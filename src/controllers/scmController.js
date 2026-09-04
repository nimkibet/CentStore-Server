import { createPOReceivedJournalEntry } from '../services/autoAccounting.js';
import Vendor from '../models/Vendor.js';
import Warehouse from '../models/Warehouse.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Product from '../models/Product.js';
import eventBus from '../services/eventBus.js';
import { triggerLowStockDraftPOForProduct, handleLowStockDeduction } from '../services/scmService.js';

// --- VENDOR CONTROLLERS ---

export const createVendor = async (req, res) => {
  try {
    const { name, code, vendorCode, contactName, contactPerson, email, phone, address, categories, paymentTerms, status, notes, taxId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Vendor name is required' });
    }

    const finalCode = (vendorCode || code || `VEN-${Date.now().toString().slice(-6)}`).toUpperCase().trim();

    const existingVendor = await Vendor.findOne({
      $or: [
        { vendorCode: finalCode },
        ...(email ? [{ email: email.toLowerCase().trim() }] : [])
      ]
    });

    if (existingVendor) {
      return res.status(400).json({ error: 'Vendor with this code or email already exists' });
    }

    let parsedAddress = { street: '', city: 'Nairobi', country: 'Kenya' };
    if (typeof address === 'string') {
      parsedAddress.street = address;
    } else if (address && typeof address === 'object') {
      parsedAddress = { ...parsedAddress, ...address };
    }

    const vendor = new Vendor({
      vendorCode: finalCode,
      name: name.trim(),
      contactName: (contactName || contactPerson || '').trim(),
      email: (email || '').toLowerCase().trim(),
      phone: (phone || '').trim(),
      address: parsedAddress,
      taxId: taxId || '',
      categories: Array.isArray(categories) ? categories : (categories ? [categories] : []),
      paymentTerms: paymentTerms || 'net30',
      status: status || 'active',
      notes: notes || ''
    });

    const savedVendor = await vendor.save();
    return res.status(201).json(savedVendor);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create vendor: ' + err.message });
  }
};

export const getVendors = async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(String(search), 'i');
      filter.$or = [
        { name: searchRegex },
        { vendorCode: searchRegex },
        { contactName: searchRegex },
        { email: searchRegex }
      ];
    }

    const vendors = await Vendor.find(filter).sort({ createdAt: -1 });
    return res.status(200).json(vendors);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch vendors: ' + err.message });
  }
};

// --- WAREHOUSE CONTROLLERS ---

export const createWarehouse = async (req, res) => {
  try {
    const { name, code, location, capacity, manager, contactPerson, isDefault, status } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Warehouse name is required' });
    }

    const finalCode = (code || `WH-${Date.now().toString().slice(-6)}`).toUpperCase().trim();

    const existingWh = await Warehouse.findOne({ code: finalCode });
    if (existingWh) {
      return res.status(400).json({ error: `Warehouse with code "${finalCode}" already exists` });
    }

    let parsedLocation = { address: '', city: 'Nairobi', country: 'Kenya' };
    if (typeof location === 'string') {
      parsedLocation.address = location;
    } else if (location && typeof location === 'object') {
      parsedLocation = { ...parsedLocation, ...location };
    }

    let parsedContact = { name: '', email: '', phone: '' };
    if (contactPerson && typeof contactPerson === 'object') {
      parsedContact = { ...parsedContact, ...contactPerson };
    } else if (manager) {
      parsedContact.name = manager;
    }

    const warehouse = new Warehouse({
      code: finalCode,
      name: name.trim(),
      location: parsedLocation,
      contactPerson: parsedContact,
      capacity: capacity ? Number(capacity) : 10000,
      manager: manager || parsedContact.name || '',
      isDefault: Boolean(isDefault),
      status: status || 'active',
      products: []
    });

    const savedWarehouse = await warehouse.save();

    if (savedWarehouse.isDefault) {
      await Warehouse.updateMany(
        { _id: { $ne: savedWarehouse._id } },
        { isDefault: false }
      );
    }

    return res.status(201).json(savedWarehouse);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create warehouse: ' + err.message });
  }
};

export const getWarehouses = async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(String(search), 'i');
      filter.$or = [
        { name: searchRegex },
        { code: searchRegex },
        { manager: searchRegex }
      ];
    }

    const warehouses = await Warehouse.find(filter)
      .populate('products.product', 'title name price stock category')
      .sort({ createdAt: -1 });

    return res.status(200).json(warehouses);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch warehouses: ' + err.message });
  }
};

// --- PURCHASE ORDER CONTROLLERS ---

export const createPurchaseOrder = async (req, res) => {
  try {
    const { vendor, warehouse, items, expectedDeliveryDate, notes, status, poNumber } = req.body;

    if (!vendor) {
      return res.status(400).json({ error: 'Vendor ID is required' });
    }
    if (!warehouse) {
      return res.status(400).json({ error: 'Warehouse ID is required' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Purchase Order must contain at least one line item' });
    }

    const dbVendor = await Vendor.findById(vendor);
    if (!dbVendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const dbWarehouse = await Warehouse.findById(warehouse);
    if (!dbWarehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    let subtotalAmount = 0;
    const formattedItems = [];

    for (const item of items) {
      if (!item.product) {
        return res.status(400).json({ error: 'Product ID is required for each PO item' });
      }

      const dbProduct = await Product.findOne({
        $or: [
          { _id: item.product },
          ...(typeof item.product === 'number' || !isNaN(Number(item.product)) ? [{ id: Number(item.product) }] : [])
        ]
      });

      if (!dbProduct) {
        return res.status(404).json({ error: `Product not found: ${item.product}` });
      }

      const qty = Number(item.quantity || item.quantityOrdered) || 1;
      const unitCost = item.unitCost !== undefined ? Number(item.unitCost) : Math.round(dbProduct.price * 0.6);
      const subtotal = qty * unitCost;
      subtotalAmount += subtotal;

      formattedItems.push({
        product: dbProduct._id,
        productTitle: dbProduct.title || dbProduct.name || 'Item',
        quantityOrdered: qty,
        quantityReceived: 0,
        unitCost,
        subtotal
      });
    }

    const finalPoNumber = (poNumber || `PO-${Date.now().toString().slice(-6)}`).toUpperCase().trim();

    const po = new PurchaseOrder({
      poNumber: finalPoNumber,
      vendor: dbVendor._id,
      warehouse: dbWarehouse._id,
      items: formattedItems,
      subtotalAmount,
      taxAmount: 0,
      totalAmount: subtotalAmount,
      status: status || 'draft',
      isAutoGenerated: false,
      notes: notes || '',
      createdBy: req.staff ? req.staff._id : undefined,
      expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
      apInvoiceCreated: false
    });

    const savedPo = await po.save();
    const populatedPo = await PurchaseOrder.findById(savedPo._id)
      .populate('vendor', 'name vendorCode email phone paymentTerms')
      .populate('warehouse', 'name code location')
      .populate('createdBy', 'name role')
      .populate('items.product', 'title name price stock');

    return res.status(201).json(populatedPo);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create purchase order: ' + err.message });
  }
};

export const getPurchaseOrders = async (req, res) => {
  try {
    const { status, vendor, warehouse, search } = req.query;
    const filter = {};

    if (status) {
      filter.status = status;
    }
    if (vendor) {
      filter.vendor = vendor;
    }
    if (warehouse) {
      filter.warehouse = warehouse;
    }
    if (search) {
      const searchRegex = new RegExp(String(search), 'i');
      filter.poNumber = searchRegex;
    }

    const pos = await PurchaseOrder.find(filter)
      .populate('vendor', 'name vendorCode email phone paymentTerms')
      .populate('warehouse', 'name code location')
      .populate('createdBy', 'name role')
      .populate('items.product', 'title name price stock')
      .sort({ createdAt: -1 });

    return res.status(200).json(pos);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch purchase orders: ' + err.message });
  }
};

export const updatePurchaseOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['draft', 'ordered', 'received', 'cancelled'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status "${status}". Allowed values: ${allowedStatuses.join(', ')}`
      });
    }

    const po = await PurchaseOrder.findById(id);
    if (!po) {
      return res.status(404).json({ error: 'Purchase Order not found' });
    }

    if (po.status === 'received') {
      return res.status(400).json({
        error: 'Purchase Order has already been received and inventory updated.'
      });
    }

    if (po.status === 'cancelled') {
      return res.status(400).json({
        error: 'Cancelled Purchase Orders cannot be updated.'
      });
    }

    // Stock update when status transitions to 'received'
    if (status === 'received') {
      for (const item of po.items) {
        // Increment global Product stock
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: item.quantityOrdered }
        });
        item.quantityReceived = item.quantityOrdered;
      }

      // Increment Warehouse-specific stock
      const warehouse = await Warehouse.findById(po.warehouse);
      if (warehouse) {
        for (const item of po.items) {
          const existingProductIndex = warehouse.products.findIndex(
            p => p.product.toString() === item.product.toString()
          );
          if (existingProductIndex > -1) {
            warehouse.products[existingProductIndex].quantity += item.quantityOrdered;
          } else {
            warehouse.products.push({
              product: item.product,
              quantity: item.quantityOrdered,
              reorderPoint: 5
            });
          }
        }
        await warehouse.save();
      }

      po.receivedAt = new Date();
      eventBus.emit('po:received', {
        poId: po._id,
        poNumber: po.poNumber,
        totalAmount: po.totalAmount,
        vendorId: po.vendor
      });
    }

    po.status = status;
    const updatedPo = await po.save();

    // Trigger Auto-Accounting GL Entry (Fire & Forget)
    if (status === 'received') {
      createPOReceivedJournalEntry({ poId: updatedPo._id, vendorName: 'Vendor', totalAmount: updatedPo.totalAmount });
    }

    const populatedPo = await PurchaseOrder.findById(updatedPo._id)
      .populate('vendor', 'name vendorCode email phone')
      .populate('warehouse', 'name code location')
      .populate('createdBy', 'name role')
      .populate('items.product', 'title name price stock');

    return res.status(200).json({
      message: `Purchase Order status successfully updated to ${status}.`,
      purchaseOrder: populatedPo
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update purchase order status: ' + err.message });
  }
};

export const triggerLowStockDraftPO = async (req, res) => {
  try {
    const { productId } = req.body;
    if (productId) {
      const draftPo = await triggerLowStockDraftPOForProduct(productId);
      return res.status(200).json({ message: 'Low stock draft PO triggered', purchaseOrder: draftPo });
    }

    // Trigger for all products with stock <= reorderPoint
    const lowStockProducts = await Product.find({});
    const generated = [];
    for (const p of lowStockProducts) {
      const rp = p.reorderPoint ?? 5;
      if (p.stock <= rp) {
        const po = await handleLowStockDeduction({
          productId: p._id,
          title: p.title || p.name,
          newStock: p.stock,
          reorderPoint: rp,
          reorderQuantity: p.reorderQuantity ?? 20,
          preferredVendor: p.preferredVendor,
          unitCost: Math.round(p.price * 0.6)
        });
        if (po) generated.push(po);
      }
    }

    return res.status(200).json({
      message: `Triggered low stock check. Generated ${generated.length} new draft POs.`,
      purchaseOrders: generated
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to trigger low stock draft PO: ' + err.message });
  }
};
