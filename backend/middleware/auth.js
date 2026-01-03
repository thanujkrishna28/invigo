const jwt = require('jsonwebtoken');
const { findUserById } = require('../utils/userHelper');

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (!decoded || !decoded.id) {
        console.error('❌ Invalid token payload - missing id');
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }
      
      req.user = await findUserById(decoded.id);
      
      if (!req.user) {
        console.error(`❌ User not found for token ID: ${decoded.id}`);
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      if (req.user.isActive === false) {
        console.error(`❌ User account deactivated: ${decoded.id}`);
        return res.status(401).json({
          success: false,
          message: 'User account is deactivated'
        });
      }

      next();
    } catch (err) {
      console.error('❌ Token verification error:', err.message);
      if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired token'
        });
      }
      // Re-throw other errors to be caught by outer catch
      throw err;
    }
  } catch (error) {
    console.error('❌ Error in protect middleware:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error in authentication'
    });
  }
};

// Role-based authorization
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};

