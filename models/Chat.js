const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const chatSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  messages: [messageSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  issue: {
    type: String,
    required: true,
    maxlength: 500
  },
  category: {
    type: String,
    enum: ['health', 'medication', 'mobility', 'emotional', 'daily_care', 'emergency', 'other'],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['active', 'resolved', 'archived'],
    default: 'active'
  },
  review: {
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    feedback: {
      type: String,
      maxlength: 1000,
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    }
  },
  metadata: {
    totalMessages: {
      type: Number,
      default: 0
    },
    lastActivity: {
      type: Date,
      default: Date.now
    },
    averageResponseTime: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Index for better performance
chatSchema.index({ userId: 1, createdAt: -1 });
chatSchema.index({ isActive: 1 });
chatSchema.index({ status: 1 });

// Update metadata before saving
chatSchema.pre('save', function(next) {
  this.metadata.totalMessages = this.messages.length;
  this.metadata.lastActivity = new Date();
  next();
});

// Virtual for formatted creation date
chatSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString();
});

// Ensure virtual fields are serialized
chatSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Chat', chatSchema);
