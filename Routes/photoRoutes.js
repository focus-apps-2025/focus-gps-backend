// routes/photoRoutes.js (Example - add this route)
const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/auth'); // Assuming these exist
const { uploadPhoto, getMyPhotos, getAllPhotos, exportPhotosCSV, deletePhoto } = require('../controllers/photoController');

// Assuming multer for file uploads
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Existing routes
router.post('/upload', protect, upload.single('image'), uploadPhoto);
router.get('/my', protect, getMyPhotos);
router.get('/all', protect, authorizeRoles('admin'), getAllPhotos);
router.get('/export', protect, authorizeRoles('admin'), exportPhotosCSV);

// *** NEW DELETE ROUTE ***
router.delete('/:id', protect, deletePhoto); // Protect ensures logged in, deletePhoto handles admin/owner authorization

module.exports = router;
