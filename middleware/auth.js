/**************************************************************************
 * Authentication & Authorization Middleware

 **************************************************************************/
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * @desc    Protect routes - verifies JWT and attaches user to req.user
 * @access  Private
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // 1️⃣  Look for Bearer token **and** safely extract it
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token provided' });
    }

    // 2️⃣  Verify token with proper error handling
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.error('JWT verification failed:', err.message);
      return res.status(401).json({ message: 'Not authorized, token invalid or expired' });
    }

    // 3️⃣  Fetch the user but exclude sensitive fields
    const user = await User.findById(decoded.id).select('-passwordHash -__v');
    if (!user) {
      return res.status(401).json({ message: 'User not found, authorization denied' });
    }

    // 4️⃣  Attach sanitized user object
    req.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error('Protect middleware error:', error);
    return res.status(500).json({ message: 'Server error while authorizing user' });
  }
};

/**
 * @desc    Restrict route access to specific roles
 * @usage   router.get('/admin', protect, authorize('admin'))
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized, no user context' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied: role '${req.user.role}' is not permitted`,
      });
    }

    next();
  };
};

module.exports = { protect, authorizeRoles };
