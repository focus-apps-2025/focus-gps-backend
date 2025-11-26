// backend/Routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { 
    loginUser, 
    getUserProfile, 
    refreshAccessToken, 
    logoutUser, 
    validateLogin // *** IMPORT validateLogin ***
} = require('../controllers/authController');

// *** CHANGE: Add validateLogin middleware to the login route ***
router.post('/login', validateLogin, loginUser);
router.get('/profile', protect, getUserProfile);
router.post('/refresh', refreshAccessToken);
router.post('/logout', logoutUser);

module.exports = router;
