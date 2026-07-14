/**
 * @fileoverview User Mongoose model.
 *
 * Represents an authenticated user account in DevWatch.
 * Responsibilities:
 *   - Stores identity, credentials, role, and profile data.
 *   - Hashes passwords automatically via a pre-save hook (bcryptjs).
 *   - Excludes the password field from all JSON/Object serializations by default.
 *   - Exposes an instance method for password comparison (comparePassword).
 *   - Applies soft-delete support via the softDeletePlugin.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { APP_CONSTANTS } from '../constants/appConstants.js';
import { softDeletePlugin } from './plugins/softDelete.plugin.js';

const { ROLES, PASSWORD } = APP_CONSTANTS;

// ── Schema ────────────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required.'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters.'],
      maxlength: [100, 'Full name must not exceed 100 characters.'],
    },

    email: {
      type: String,
      required: [true, 'Email address is required.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address.'],
      maxlength: [254, 'Email address must not exceed 254 characters.'],
    },

    password: {
      type: String,
      required: [true, 'Password is required.'],
      minlength: [
        PASSWORD.MIN_LENGTH,
        `Password must be at least ${PASSWORD.MIN_LENGTH} characters.`,
      ],
      maxlength: [
        PASSWORD.MAX_LENGTH,
        `Password must not exceed ${PASSWORD.MAX_LENGTH} characters.`,
      ],
      select: false, // Excluded from all queries by default
    },

    role: {
      type: String,
      enum: {
        values: Object.values(ROLES),
        message: `Role must be one of: ${Object.values(ROLES).join(', ')}.`,
      },
      default: ROLES.VIEWER,
    },

    avatar: {
      type: String,
      trim: true,
      default: null,
    },

    company: {
      type: String,
      trim: true,
      maxlength: [100, 'Company name must not exceed 100 characters.'],
      default: null,
    },

    status: {
      type: String,
      enum: {
        values: ['active', 'inactive'],
        message: 'Status must be either active or inactive.',
      },
      default: 'active',
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    lastLogin: {
      type: Date,
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,

    // ── Serialization ──────────────────────────────────────────────────────────
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.password; // Never expose password hash
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.password;
        return ret;
      },
    },
  }
);

// ── Soft Delete ───────────────────────────────────────────────────────────────
userSchema.plugin(softDeletePlugin);

// ── Indexes ───────────────────────────────────────────────────────────────────
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ createdAt: -1 });

// ── Virtuals ──────────────────────────────────────────────────────────────────

/**
 * Returns the user's initials derived from their full name.
 * Useful for avatar placeholders in the frontend.
 *
 * @returns {string} e.g. "JD" for "John Doe"
 */
userSchema.virtual('initials').get(function () {
  return this.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
});

/**
 * Returns true if the account is currently active.
 *
 * @returns {boolean}
 */
userSchema.virtual('isActive').get(function () {
  return this.status === 'active' && !this.isDeleted;
});

// ── Pre-save Hook — Password Hashing ─────────────────────────────────────────

/**
 * Automatically hashes the password whenever it is set or modified.
 * Skips hashing if the password field has not changed.
 */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, PASSWORD.SALT_ROUNDS);
  next();
});

// ── Instance Methods ──────────────────────────────────────────────────────────

/**
 * Securely compares a plain-text candidate password against the stored hash.
 *
 * @param {string} candidatePassword - The password to verify
 * @returns {Promise<boolean>} True if the password matches
 */
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Updates the lastLogin timestamp to the current UTC time.
 *
 * @returns {Promise<this>}
 */
userSchema.methods.recordLogin = function () {
  this.lastLogin = new Date();
  return this.save();
};

// ── Static Methods ────────────────────────────────────────────────────────────

/**
 * Finds a user by email, explicitly selecting the password field.
 * Use this only in authentication flows where the hash is needed.
 *
 * @param {string} email
 * @returns {Promise<import('mongoose').Document|null>}
 */
userSchema.statics.findByEmailWithPassword = function (email) {
  return this.findOne({ email: email.toLowerCase().trim() }).select('+password');
};

/**
 * Returns all users with the specified role.
 *
 * @param {string} role
 * @returns {Promise<import('mongoose').Document[]>}
 */
userSchema.statics.findByRole = function (role) {
  return this.find({ role, status: 'active' }).sort({ createdAt: -1 });
};

/**
 * Returns the count of active, non-deleted users.
 *
 * @returns {Promise<number>}
 */
userSchema.statics.countActive = function () {
  return this.countDocuments({ status: 'active' });
};

// ── Query Helpers ─────────────────────────────────────────────────────────────

/**
 * Chainable query helper to filter only active users.
 *
 * @example
 * await User.find().active()
 */
userSchema.query.active = function () {
  return this.where({ status: 'active' });
};

/**
 * Chainable query helper to filter only admin users.
 *
 * @example
 * await User.find().admins()
 */
userSchema.query.admins = function () {
  return this.where({ role: ROLES.ADMIN });
};

// ── Model Export ──────────────────────────────────────────────────────────────

const User = mongoose.model('User', userSchema);

export { User };
