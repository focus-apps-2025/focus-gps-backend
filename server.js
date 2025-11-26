/***************************************************************************
 *  Production‑Ready Express Server
 ***************************************************************************/
require('dotenv').config();              // ✅ Load environment variables early

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');        // ✅ Security headers
       // ✅ Logging
const rateLimit = require('express-rate-limit'); // ✅ Basic rate limiting
const cookieParser = require('cookie-parser');
const path = require('path');

const connectDB = require('./config/db');
const authRoutes = require('./Routes/authRoutes');
const photoRoutes = require('./Routes/photoRoutes');
const userRoutes = require('./Routes/userRoutes');

const app = express();

/* ---------------------------------------------------------------------- */
/* Database Connection                                                    */
/* ---------------------------------------------------------------------- */
connectDB()
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB connection failed', err.message);
    process.exit(1);
  });

/* ---------------------------------------------------------------------- */
/* Security & Performance Middlewares                                     */
/* ---------------------------------------------------------------------- */
app.use(helmet());                       // Adds HTTP security headers
app.use(express.json({ limit: '5mb' })); // Parse JSON safely & limit size
app.use(cookieParser());                 // Allow cookies (JWT refresh tokens)

// CORS: restrict to allowed origins
const allowedOrigins = [
  'https://0f648777.focus-gps-frontends.pages.dev/',            // ✅ optional prod frontend URL
];
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin like mobile apps or curl
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS not allowed by policy'));
    },
    credentials: true,
  })
);

// Limit repeated requests to public APIs
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,                 // limit each IP to 500 requests per windowMs
  message: 'Too many requests, try again later.',
});
app.use(limiter);



/* ---------------------------------------------------------------------- */
/* API Routes                                                             */
/* ---------------------------------------------------------------------- */
app.use('/api/auth', authRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/users', userRoutes);

/* ---------------------------------------------------------------------- */
/* Health Check & Root                                                    */
/* ---------------------------------------------------------------------- */
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is running',
    uptime: process.uptime(),
  });
});

/* ---------------------------------------------------------------------- */
/* Serve Frontend (if deployed together, e.g. Heroku / Render / Vercel)  */
/* ---------------------------------------------------------------------- */
if (process.env.NODE_ENV === "production") {
  console.log("⚠️ Skipping frontend serving in production");
} else {
  app.use(express.static(path.join(__dirname, "frontend/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend/dist/index.html"));
  });
}




/* ---------------------------------------------------------------------- */
/* Global Error Handler                                                   */
/* ---------------------------------------------------------------------- */
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack || err);
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    message: err.message || 'Internal Server Error',
  });
});

/* ---------------------------------------------------------------------- */
/* Start Server                                                           */
/* ---------------------------------------------------------------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
);

/* ---------------------------------------------------------------------- */
/* Graceful Shutdown                                                      */
/* ---------------------------------------------------------------------- */
process.on('SIGTERM', () => {
  console.info('SIGTERM signal received: closing HTTP server.');
  app.close(() => {
    console.log('HTTP server closed.');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed.');
      process.exit(0);
    });
  });
});
