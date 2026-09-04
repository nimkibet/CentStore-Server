import Customer from '../models/Customer.js';
import Order from '../models/Order.js';

export const getCustomers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;
    
    const query = {};
    if (req.query.search) {
      query.$or = [
        { name: new RegExp(req.query.search, 'i') },
        { phone: new RegExp(req.query.search, 'i') }
      ];
    }
    
    const [customers, total] = await Promise.all([
      Customer.find(query).sort({ lastPurchaseDate: -1, createdAt: -1 }).skip(skip).limit(limit),
      Customer.countDocuments(query)
    ]);
    
    res.json({ data: customers, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch customers: ' + err.message }); }
};

export const createCustomer = async (req, res) => {
  try {
    const { name, phone, email, address, tags } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });
    
    const existing = await Customer.findOne({ phone });
    if (existing) return res.status(400).json({ error: 'Customer with this phone already exists' });
    
    const customer = await new Customer({ name, phone, email, address, tags }).save();
    res.status(201).json(customer);
  } catch (err) { res.status(500).json({ error: 'Failed to create customer: ' + err.message }); }
};

export const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch customer: ' + err.message }); }
};

export const updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) { res.status(500).json({ error: 'Failed to update customer: ' + err.message }); }
};

export const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Customer deleted successfully' });
  } catch (err) { res.status(500).json({ error: 'Failed to delete customer: ' + err.message }); }
};

export const getCustomerPurchaseHistory = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    
    const orders = await Order.find({ 'shippingAddress.phone': customer.phone }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch purchase history: ' + err.message }); }
};
