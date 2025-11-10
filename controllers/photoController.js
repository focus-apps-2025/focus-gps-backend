const Photo = require('../models/Photo');
const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream'); // Import Readable from stream module

// Helper to convert buffer to data URI
const bufferToDataUri = (buffer, mimetype) =>
  `data:${mimetype};base64,${buffer.toString('base64')}`;

// @desc    Upload a new photo
// @route   POST /api/photos/upload
// @access  Private (User)
const uploadPhoto = async (req, res) => {
    const { latitude, longitude, accuracy } = req.body;

    if (!req.file) {
        return res.status(400).json({ message: 'No image file provided.' });
    }

    // Check for daily upload
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const existingPhotoToday = await Photo.findOne({
        userId: req.user._id,
        timestamp: { $gte: startOfToday, $lte: endOfToday },
    });

    if (existingPhotoToday) {
        return res.status(400).json({ message: "You've already captured a photo today. Only one per day allowed." });
    }

    try {
        // Upload image to Cloudinary
        const dataUri = bufferToDataUri(req.file.buffer, req.file.mimetype);
        const result = await cloudinary.uploader.upload(dataUri, {
            folder: 'focus-gps-camera-system',
        });

        const photo = await Photo.create({
            userId: req.user._id,
            imageUrl: result.secure_url,
            latitude,
            longitude,
            accuracy,
            timestamp: new Date(),
        });

        res.status(201).json({ message: 'Photo uploaded successfully', photo });
    } catch (error) {
        console.error('Error uploading photo:', error);
        res.status(500).json({ message: 'Server error during photo upload.' });
    }
};


// @desc    Get all photos for the logged-in user
// @route   GET /api/photos/my
// @access  Private (User)
const getMyPhotos = async (req, res) => {
    try {
        const photos = await Photo.find({ userId: req.user._id }).sort({ timestamp: -1 });
        res.json(photos);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all photos (Admin only)
// @route   GET /api/photos/all
// @access  Private (Admin)
const getAllPhotos = async (req, res) => {
    try {
        let query = {};
        const { date, userId } = req.query;

        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            query.timestamp = { $gte: startOfDay, $lte: endOfDay };
        }

        if (userId) {
            query.userId = userId;
        }

        const photos = await Photo.find(query).populate('userId', 'name email').sort({ timestamp: -1 });
        res.json(photos);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Export all photo metadata to CSV (Admin only)
// @route   GET /api/photos/export
// @access  Private (Admin)
const exportPhotosCSV = async (req, res) => {
    try {
        const photos = await Photo.find({}).populate('userId', 'name email').sort({ timestamp: 1 });

        let csv = "User Name,User Email,Image URL,Latitude,Longitude,Accuracy,Timestamp\n";

        photos.forEach(photo => {
            csv += `${photo.userId.name},${photo.userId.email},${photo.imageUrl},${photo.latitude},${photo.longitude},${photo.accuracy || 'N/A'},${photo.timestamp.toISOString()}\n`;
        });

        res.header('Content-Type', 'text/csv');
        res.attachment('photos_export.csv');
        res.send(csv);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { uploadPhoto, getMyPhotos, getAllPhotos, exportPhotosCSV };