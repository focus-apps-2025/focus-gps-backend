/***************************************************************************
 * User Model
 ***************************************************************************/
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto'); // for hashing refresh tokens safely

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },

    /**
     * Store the hashed refresh token so that even if
     * MongoDB leaks, tokens can’t be reused by attackers.
     * (Not selected by default for safety)
     */
    refreshTokenHash: { type: String, select: false },
  },
  { timestamps: true }
);

/* ---------------------------------------------------------------------- */
/*                      Instance Methods                                  */
/* ---------------------------------------------------------------------- */

// Compare candidate password with stored hash
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

// Hash plain password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();

  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

/**
 * Hash and store the refresh token
 * (called after issuing new refresh tokens)
 */
userSchema.methods.setRefreshToken = async function (token) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  this.refreshTokenHash = hash;
  await this.save();
};

/**
 * Check whether a given refresh token matches the saved one
 */
userSchema.methods.isRefreshTokenValid = function (token) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return hash === this.refreshTokenHash;
};

module.exports = mongoose.model('User', userSchema);
