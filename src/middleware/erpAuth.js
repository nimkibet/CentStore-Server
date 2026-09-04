import jwt from 'jsonwebtoken';
import Staff from '../models/Staff.js';

export const protectStaff = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const staff = await Staff.findById(decoded.id).select('-password');
    if (!staff || staff.status !== 'active') {
      return res.status(401).json({ error: 'Staff account is inactive or not found' });
    }
    req.staff = staff;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Not authorized, token validation failed' });
  }
};

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.staff) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // CEO role has access to all routes
    if (req.staff.role === 'CEO') {
      return next();
    }

    if (!roles.includes(req.staff.role)) {
      return res.status(403).json({
        error: `Access Denied: Role '${req.staff.role}' does not have permission to execute this operation`
      });
    }
    next();
  };
};

/**
 * Permission-based authorization middleware.
 * Allows access if the staff member has ANY ONE of the required permissions.
 * CEO bypasses all permission checks.
 * Usage: authorizePermissions('scm:read', 'inventory:read')
 */
export const authorizePermissions = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.staff) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.staff.role === 'CEO') {
      return next();
    }
    const staffPermissions = req.staff.permissions || [];
    const hasPermission = requiredPermissions.some(perm => staffPermissions.includes(perm));
    if (!hasPermission) {
      return res.status(403).json({ error: `Access Denied: Missing permission (${requiredPermissions.join(' or ')})` });
    }
    next();
  };
};
