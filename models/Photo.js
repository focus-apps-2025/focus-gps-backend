// models/Photo.js
const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    imageUrl: {
        type: String,
        required: true,
    },
    // *** NEW FIELD: Store Cloudinary Public ID for deletion ***
    cloudinaryPublicId: {
        type: String,
        required: true, // Assuming every uploaded photo gets a public ID
    },
    latitude: {
        type: Number,
        required: true,
    },
    longitude: {
        type: Number,
        required: true,
    },
    accuracy: {
        type: Number,
        required: true,
    },
    address: {
        type: String,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Photo', photoSchema);
