// backend/controllers/photoController.js
const Photo = require('../models/Photo');
const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');
// *** NEW: Import check, validationResult from express-validator ***
const { body, validationResult } = require('express-validator');

// Helper to convert buffer to data URI (unchanged)
const bufferToDataUri = (buffer, mimetype) =>
  `data:${mimetype};base64,${buffer.toString('base64')}`;

// *** NEW: Validation middleware for uploadPhoto ***
const validateUploadPhoto = [
    // Validate latitude: must be a float, within valid geographic range
    body('latitude')
        .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be a valid number between -90 and 90.'),
    // Validate longitude: must be a float, within valid geographic range
    body('longitude')
        .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be a valid number between -180 and 180.'),
    // Validate accuracy: must be a float or integer, non-negative
    body('accuracy')
        .isFloat({ min: 0 }).withMessage('Accuracy must be a non-negative number.'),
    // Validate address: optional string, can be empty, but if present, sanitize it
    body('address')
        .optional()
        .isString().withMessage('Address must be a string.')
        .trim() // Remove leading/trailing whitespace
        .escape() // Escape HTML entities to prevent XSS if ever displayed directly
        .isLength({ max: 500 }).withMessage('Address cannot be longer than 500 characters.'),
];

// @desc    Upload a new photo
// @route   POST /api/photos/upload
// @access  Private (User)
const uploadPhoto = async (req, res) => {
    // *** NEW: Check for validation errors here ***
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    // Continue with existing logic if no validation errors
    
    const { latitude, longitude, accuracy, address } = req.body;

    if (!req.file) {
        return res.status(400).json({ message: 'No image file provided.' });
    }

    try {
        // Upload image to Cloudinary (unchanged)
        const dataUri = bufferToDataUri(req.file.buffer, req.file.mimetype);
        const result = await cloudinary.uploader.upload(dataUri, {
            folder: 'focus-gps-camera-system',
            // OPTIONAL: Add tags for better management (e.g., user ID, date)
            tags: [`user_${req.user._id}`, `date_${new Date().toISOString().split('T')[0]}`],
        });

        const photo = await Photo.create({
            userId: req.user.id,
            imageUrl: result.secure_url,
            cloudinaryPublicId: result.public_id,
            latitude,
            longitude,
            accuracy,
            address,
            timestamp: new Date(),
        });

        res.status(201).json({ message: 'Photo uploaded successfully', photo });
    } catch (error) {
        console.error('Error uploading photo:', error);
        res.status(500).json({ message: 'Server error during photo upload.' });
    }
};

// @desc    Get all photos for the logged-in user (unchanged)
// @route   GET /api/photos/my
// @access  Private (User)
const getMyPhotos = async (req, res) => {
    try {
        // OPTIONAL: You can make this route slightly more efficient by only selecting necessary fields
        const photos = await Photo.find({ userId: req.user.id }).select('imageUrl latitude longitude accuracy address timestamp userId')
.sort({ timestamp: -1 });
        res.json(photos);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all photos (Admin only) (unchanged)
// @route   GET /api/photos/all
// @access  Private (Admin)
const getAllPhotos = async (req, res) => {
    // OPTIONAL: Add validation for date and userId query parameters
    try {
        let query = {};
        const { date, userId } = req.query;

        if (date) {
            // Further validation to ensure date is a valid date string
            const parsedDate = new Date(date);
            if (isNaN(parsedDate.getTime())) {
                return res.status(400).json({ message: 'Invalid date format.' });
            }
            const startOfDay = new Date(parsedDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(parsedDate);
            endOfDay.setHours(23, 59, 59, 999);
            query.timestamp = { $gte: startOfDay, $lte: endOfDay };
        }

        if (userId) {
            // Further validation to ensure userId is a valid MongoDB ObjectId
            if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
                return res.status(400).json({ message: 'Invalid User ID format.' });
            }
            query.userId = userId;
        }

        const photos = await Photo.find(query).populate('userId', 'name email').sort({ timestamp: -1 });
        res.json(photos);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Export all photo metadata to CSV (Admin only) (unchanged)
// @route   GET /api/photos/export
// @access  Private (Admin)
const exportPhotosCSV = async (req, res) => {
    try {
        const photos = await Photo.find({}).populate('userId', 'name email').sort({ timestamp: 1 });

        let csv = "User Name,User Email,Image URL,Latitude,Longitude,Accuracy,Timestamp,Address\n"; // Added Address header

        photos.forEach(photo => {
            csv += `${photo.userId.name},${photo.userId.email},${photo.imageUrl},${photo.latitude},${photo.longitude},${photo.accuracy || 'N/A'},${photo.timestamp.toISOString()},"${(photo.address || '').replace(/"/g, '""')}"\n`; // Added Address, handle commas/quotes
        });

        res.header('Content-Type', 'text/csv');
        res.attachment('photos_export.csv');
        res.send(csv);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a photo (unchanged logic, already robust)
// @route   DELETE /api/photos/:id
// @access  Private (User or Admin)
const deletePhoto = async (req, res) => {
    try {
        const photo = await Photo.findById(req.params.id);

        if (!photo) {
            return res.status(404).json({ message: 'Photo not found.' });
        }

        // FIX: Add null checks and consistent property access
        const isAdmin = req.user?.role === 'admin'; 
        
        // FIX: Handle cases where userId or _id might be undefined
        const photoUserId = photo.userId?.toString();
        const reqUserId = req.user?._id?.toString() || req.user?.id?.toString();
        
        const isOwner = photoUserId && reqUserId && photoUserId === reqUserId;

        if (!isAdmin && !isOwner) {
            return res.status(403).json({ message: 'Not authorized to delete this photo.' });
        }

        if (photo.cloudinaryPublicId) {
            await cloudinary.uploader.destroy(photo.cloudinaryPublicId);
            console.log(`Cloudinary image ${photo.cloudinaryPublicId} deleted.`);
        } else {
            console.warn(`Photo ${photo._id} has no cloudinaryPublicId. Skipping Cloudinary deletion.`);
        }

        await photo.deleteOne(); 

        res.json({ message: 'Photo deleted successfully.' });

    } catch (error) {
        console.error('Error deleting photo:', error);
        res.status(500).json({ message: 'Server error during photo deletion.' });
    }
};

module.exports = { validateUploadPhoto, uploadPhoto, getMyPhotos, getAllPhotos, exportPhotosCSV, deletePhoto };
