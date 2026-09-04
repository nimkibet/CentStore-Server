import Product from '../models/Product.js';

export const checkTrialLimit = async (req, res, next) => {
  try {
    const activeProductCount = await Product.countDocuments({ status: 'active' });
    if (activeProductCount >= 10) {
      return res.status(403).json({
        error: 'Trial Limit Reached. Contact Developer for Full Access.'
      });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify trial status: ' + error.message });
  }
};
