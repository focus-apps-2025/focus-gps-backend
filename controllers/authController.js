

/**************************************************************************
 * Authentication Controller
 - Enhanced with Access & Refresh Token Mechanism
***************************************************************************/

const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator'); 

// Helper to generate Access Token (short-lived)
const generateAccessToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '15m', // Access token expires in 15 minutes
    });
};

// Helper to generate Refresh Token (long-lived)
const generateRefreshToken = (id) => {
    return jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: '7d', // Refresh token expires in 7 days
    });
};
const validateLogin = [
    body('username')
        .trim()
        .notEmpty().withMessage('Username is required.'),
    body('password')
        .notEmpty().withMessage('Password is required.'),
];

// @desc    Auth user & get tokens
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    // *** NEW: Check for validation errors ***
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { username, password } = req.body;

    try {
       
        const user = await User.findOne({ name: username });

        if (user && (await user.matchPassword(password))) {
            const accessToken = generateAccessToken(user._id);
            const refreshToken = generateRefreshToken(user._id);

            const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
            user.refreshToken = hashedRefreshToken;
            await user.save();

            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Strict',
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });

            res.json({
                _id: user._id,
                name: user.name, // The username is stored in 'name'
                email: user.email,
                role: user.role,
                token: accessToken,
            });
        } else {
            // *** CHANGE: Update error message to reflect 'username' ***
            res.status(401).json({ message: 'Invalid username or password' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
};


// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
    // req.user is populated by the 'protect' middleware
    // We already have the user details from the JWT
    if (req.user) {
        res.json({
            _id: req.user._id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
        });
    } else {
        // This case should ideally not be reached if 'protect' middleware functions correctly
        res.status(404).json({ message: 'User not found' });
    }
};

// @desc    Refresh Access Token
// @route   POST /api/auth/refresh
// @access  Public (uses refresh token from cookie)
const refreshAccessToken = async (req, res) => {
    const cookies = req.cookies;

    if (!cookies?.refreshToken) {
        return res.status(401).json({ message: 'No refresh token provided in cookies' });
    }

    const refreshToken = cookies.refreshToken;

    try {
        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

        // Find user by ID and explicitly select the refreshToken field
        const user = await User.findById(decoded.id).select('+refreshToken');

        if (!user) {
            return res.status(403).json({ message: 'Forbidden: User not found with refresh token' });
        }

        // Compare hashed refresh token from cookie with the one stored in DB
        const match = await bcrypt.compare(refreshToken, user.refreshToken);

        if (!match) {
            // Refresh token reuse detected (potential attack), clear it from DB and cookie
            console.warn(`Refresh token reuse detected for user ${user.email}. Clearing token.`);
            user.refreshToken = '';
            await user.save();
            res.clearCookie('refreshToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict' });
            return res.status(403).json({ message: 'Forbidden: Invalid refresh token' });
        }

        // Generate a new access token
        const newAccessToken = generateAccessToken(user._id);

        // Optionally, rotate the refresh token for enhanced security
        // Invalidate old refresh token, generate new one, save new one
        const newRefreshToken = generateRefreshToken(user._id);
        const hashedNewRefreshToken = await bcrypt.hash(newRefreshToken, 10);
        user.refreshToken = hashedNewRefreshToken;
        await user.save();

        // Set the new refresh token as an HTTP-only cookie
        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: newAccessToken, // Frontend receives new access token
        });

    } catch (error) {
        console.error('Refresh token error:', error);
        // Clear expired or invalid refresh token cookie
        res.clearCookie('refreshToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict' });
        if (error.name === 'TokenExpiredError') {
            return res.status(403).json({ message: 'Refresh token expired', expired: true });
        }
        res.status(403).json({ message: 'Forbidden: Invalid refresh token' });
    }
};

// @desc    Logout user & clear tokens
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = async (req, res) => {
    const cookies = req.cookies;
    if (!cookies?.refreshToken) {
        return res.sendStatus(204); // No content to send, but successful (no refresh token to clear)
    }

    const refreshToken = cookies.refreshToken;

    // Find user by refresh token (implicitly by matching hashed token in DB)
    const user = await User.findOne({ refreshToken: await bcrypt.hash(refreshToken, 10) }).select('+refreshToken'); // Need to find by comparing hashed values, or adjust logic

    // A more robust way to find user to clear refresh token:
    // Decode the token first to get user ID, then find by ID.
    let decodedRefreshToken;
    try {
        decodedRefreshToken = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (error) {
        // If refresh token is invalid/expired during logout, just clear cookie
        res.clearCookie('refreshToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict' });
        return res.sendStatus(204);
    }

    const userToLogout = await User.findById(decodedRefreshToken.id).select('+refreshToken');

    if (userToLogout) {
        userToLogout.refreshToken = ''; // Clear refresh token in DB
        await userToLogout.save();
    }

    res.clearCookie('refreshToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict' }); // Clear cookie
    res.sendStatus(204); // No content
};


module.exports = { loginUser, getUserProfile, refreshAccessToken, logoutUser ,validateLogin};
