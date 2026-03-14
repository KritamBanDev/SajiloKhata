'use strict';

const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
      meta: {
        request_id: req.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired.' : 'Invalid token.';
    return res.status(401).json({
      success: false,
      message,
      meta: {
        request_id: req.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }
};

const requireAnyRole = (...roles) => (req, res, next) => {
  const userRole = req.user?.role;
  if (!userRole || !roles.includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions.',
      meta: {
        request_id: req.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }
  next();
};

const requireAdmin = requireAnyRole('Admin');

module.exports = { verifyToken, requireAnyRole, requireAdmin };
