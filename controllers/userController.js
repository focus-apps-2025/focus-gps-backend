// backend/controllers/userController.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');
// *** NEW: Import check, validationResult from express-validator ***
const { body, validationResult, param } = require('express-validator');

// *** NEW: Validation middleware for createUser and updateUser ***
const validateUserCreation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Name is required.')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters.')
        .escape(), // Sanitize name
    body('email')
        .trim()
        .isEmail().withMessage('Please enter a valid email address.')
        .normalizeEmail(), // Standardize email format
    body('password')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
    body('role')
        .optional()
        .isIn(['user', 'admin']).withMessage('Role must be either "user" or "admin".'),
];

// Validation for update (password and role can be optional)
const validateUserUpdate = [
    // Reuse name/email/role validation, but make them optional
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters.')
        .escape(),
    body('email')
        .optional()
        .trim()
        .isEmail().withMessage('Please enter a valid email address.')
        .normalizeEmail(),
    body('password')
        .optional() // Password is optional for update
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
    body('role')
        .optional()
        .isIn(['user', 'admin']).withMessage('Role must be either "user" or "admin".'),
];

// Validation for user ID in URL parameters
const validateUserIdParam = [
    param('id').isMongoId().withMessage('Invalid User ID format.'),
];


// @desc    Create a new user (Admin only)
// @route   POST /api/users
// @access  Private/Admin
const createUser = async (req, res) => {
    // *** NEW: Check for validation errors here ***
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, role } = req.body;

    try {
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User with that email already exists' });
        }

        // Password hashing is handled by pre-save hook in User model (good!)
        const user = await User.create({
            name,
            email,
            passwordHash: password, // Mongoose pre-save hook will hash this
            role: role || 'user',
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt,
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all users (unchanged, but added type filtering)
// @route   GET /api/users
// @access  Private/Admin
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}).select('-passwordHash -refreshToken'); // Also exclude refreshToken
        res.json(users);
    } catch (error) {
        console.error('Error fetching all users:', error);
        res.status(500).json({ message: 'Server error fetching users.' });
    }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private/Admin
const getUserById = async (req, res) => {
    // *** NEW: Check for validation errors for param ID ***
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const user = await User.findById(req.params.id).select('-passwordHash -refreshToken'); // Also exclude refreshToken
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Error fetching user by ID:', error);
        res.status(500).json({ message: error.message });
    }
};


// @desc    Update user (Admin only)
// @route   PUT /api/users/:id
// @access  Private/Admin
const updateUser = async (req, res) => {
    // *** NEW: Check for validation errors for param ID and body ***
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, role } = req.body;

    try {
        const user = await User.findById(req.params.id);

        if (user) {
            user.name = name !== undefined ? name : user.name; // Only update if provided
            user.email = email !== undefined ? email : user.email;
            user.role = role !== undefined ? role : user.role;

            if (password) {
                // Password hashing is handled by pre-save hook in User model
                // Just assign the new plain password, the hook will hash it
                user.passwordHash = password; // The pre-save hook will detect this change and hash
            }

            const updatedUser = await user.save();
            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete user (Admin only)
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
    // *** NEW: Check for validation errors for param ID ***
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            // Prevent admin from deleting themselves (optional but good practice)
            if (req.user._id.toString() === user._id.toString()) {
                return res.status(400).json({ message: "Admin cannot delete their own account via this route." });
            }
            await User.deleteOne({ _id: req.params.id });
            res.json({ message: 'User removed' });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    validateUserCreation, // Export new validation middleware
    validateUserUpdate,   // Export new validation middleware
    validateUserIdParam,  // Export new validation middleware
    createUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
};
