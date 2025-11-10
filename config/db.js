const mongoose = require('mongoose');
const User = require('../models/User'); // Path to your User model

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB Connected...');

        // Auto-create admin
        const existingAdmin = await User.findOne({ email: process.env.ADMIN_EMAIL });
        if (!existingAdmin && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
            const adminUser = new User({
                name: process.env.ADMIN_NAME || 'System Administrator',
                email: process.env.ADMIN_EMAIL,
                passwordHash: process.env.ADMIN_PASSWORD,
                role: 'admin'
            });
            await adminUser.save();
            console.log('✅ Auto-created admin user from environment variables');
        } else if (existingAdmin) {
            console.log('ℹ️  Admin user already exists');
        }

    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

module.exports = connectDB;