const express = require('express');
const { protect, authorizeRoles } = require('../middleware/auth');
const {
    createUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
} = require('../controllers/userController');
const router = express.Router();

// All routes here are for Admin only
router.use(protect, authorizeRoles('admin'));

// Admin: Create a new user
router.post('/', createUser);

// Admin: Get all users
router.get('/', getAllUsers);

// Admin: Get a single user by ID
router.get('/:id', getUserById);

// Admin: Update a user by ID
router.put('/:id', updateUser);

// Admin: Delete a user by ID
router.delete('/:id', deleteUser);

module.exports = router;