/**
 * @fileoverview Notification Mongoose model.
 *
 * Represents an in-app notification delivered to a specific user.
 * Responsibilities:
 *   - Tracks delivery state (delivered) and read state (read).
 *   - Supports typed notifications (alert, system, info, warning, success).
 *   - Supports priority levels for ordering in the notification inbox.
 *   - References User as the recipient.
 *   - Does NOT apply soft delete — notifications are either read or deleted permanently.
 */

import mongoose from 'mongoose';

// ── Enums ─────────────────────────────────────────────────────────────────────

const NOTIFICATION_TYPES = ['alert', 'system', 'info', 'warning', 'success'];
const NOTIFICATION_PRIORITIES = ['low', 'normal', 'high', 'urgent'];

// ── Schema ────────────────────────────────────────────────────────────────────

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient user is required.'],
      index: true,
    },

    title: {
      type: String,
      required: [true, 'Notification title is required.'],
      trim: true,
      maxlength: [200, 'Title must not exceed 200 characters.'],
    },

    message: {
      type: String,
      required: [true, 'Notification message is required.'],
      trim: true,
      maxlength: [1000, 'Message must not exceed 1000 characters.'],
    },

    type: {
      type: String,
      enum: {
        values: NOTIFICATION_TYPES,
        message: `Notification type must be one of: ${NOTIFICATION_TYPES.join(', ')}.`,
      },
      default: 'info',
    },

    priority: {
      type: String,
      enum: {
        values: NOTIFICATION_PRIORITIES,
        message: `Priority must be one of: ${NOTIFICATION_PRIORITIES.join(', ')}.`,
      },
      default: 'normal',
      index: true,
    },

    read: {
      type: Boolean,
      default: false,
      index: true,
    },

    delivered: {
      type: Boolean,
      default: false,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Notifications have createdAt but no updatedAt
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

// Inbox query: unread notifications per user, newest first
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
// Priority inbox
notificationSchema.index({ recipient: 1, priority: 1, read: 1 });

// ── Virtuals ──────────────────────────────────────────────────────────────────

/**
 * Returns true if the notification is unread.
 *
 * @returns {boolean}
 */
notificationSchema.virtual('isUnread').get(function () {
  return !this.read;
});

// ── Instance Methods ──────────────────────────────────────────────────────────

/**
 * Marks this notification as read.
 *
 * @returns {Promise<this>}
 */
notificationSchema.methods.markRead = function () {
  this.read = true;
  return this.save();
};

/**
 * Marks this notification as delivered.
 *
 * @returns {Promise<this>}
 */
notificationSchema.methods.markDelivered = function () {
  this.delivered = true;
  return this.save();
};

// ── Static Methods ────────────────────────────────────────────────────────────

/**
 * Returns all unread notifications for a user, ordered by priority then creation time.
 *
 * @param {mongoose.Types.ObjectId|string} userId
 * @returns {Promise<import('mongoose').Document[]>}
 */
notificationSchema.statics.findUnreadByUser = function (userId) {
  const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
  return this.find({ recipient: userId, read: false })
    .sort({ createdAt: -1 })
    .then((notifications) =>
      notifications.sort(
        (a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4)
      )
    );
};

/**
 * Marks all unread notifications for a user as read.
 *
 * @param {mongoose.Types.ObjectId|string} userId
 * @returns {Promise<import('mongoose').UpdateWriteOpResult>}
 */
notificationSchema.statics.markAllReadForUser = function (userId) {
  return this.updateMany({ recipient: userId, read: false }, { $set: { read: true } });
};

/**
 * Returns the count of unread notifications for a user.
 *
 * @param {mongoose.Types.ObjectId|string} userId
 * @returns {Promise<number>}
 */
notificationSchema.statics.countUnread = function (userId) {
  return this.countDocuments({ recipient: userId, read: false });
};

// ── Query Helpers ─────────────────────────────────────────────────────────────

/**
 * Chainable query helper to filter only unread notifications.
 *
 * @example
 * await Notification.find({ recipient: id }).unread()
 */
notificationSchema.query.unread = function () {
  return this.where({ read: false });
};

// ── Model Export ──────────────────────────────────────────────────────────────

const Notification = mongoose.model('Notification', notificationSchema);

export { Notification, NOTIFICATION_TYPES, NOTIFICATION_PRIORITIES };
