import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Admin from '../models/Admin.js';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
      
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        req.admin = await Admin.findById(decoded.id).select('-password');
      }
      
      return next();
    } catch (error) {
      console.error('Token authentication error:', error);
      return res.status(401).json({ error: 'Not authorized, token failed.' });
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token.' });
  }
};

export const adminOnly = (req, res, next) => {
  if ((req.user && req.user.role === 'admin') || req.admin) {
    next();
  } else {
    res.status(403).json({ error: 'Not authorized as an admin.' });
  }
};
