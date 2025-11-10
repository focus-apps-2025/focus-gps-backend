const express = require('express');
const { uploadPhoto, getMyPhotos, getAllPhotos, exportPhotosCSV } = require('../controllers/photoController');
const { protect, authorizeRoles } = require('../middleware/auth');
const router = express.Router();
const multer = require('multer');

// Configure multer for memory storage (Cloudinary will handle the upload)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


router.post('/upload', protect, upload.single('image'), uploadPhoto);
router.get('/my', protect, getMyPhotos);
router.get('/all', protect, authorizeRoles('admin'), getAllPhotos);
router.get('/export', protect, authorizeRoles('admin'), exportPhotosCSV);

module.exports = router;