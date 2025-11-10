const express = require('express');
const { loginUser, getUserProfile } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const router = express.Router();

// Public route for login
router.post('/login', loginUser);

// Private route for getting logged-in user's profile
router.get('/profile', protect, getUserProfile);

module.exports = router;