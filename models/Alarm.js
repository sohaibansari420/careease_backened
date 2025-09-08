const mongoose = require('mongoose');

const alarmSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    maxlength: 100,
    trim: true
  },
  description: {
    type: String,
    maxlength: 500,
    trim: true
  },
  time: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
alarmSchema.index({ userId: 1, time: 1 });
alarmSchema.index({ userId: 1, isActive: 1 });

// Virtual for formatted time
alarmSchema.virtual('formattedTime').get(function() {
  return this.time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
});

// Virtual for formatted date
alarmSchema.virtual('formattedDate').get(function() {
  return this.time.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
});

// Check if alarm is due
alarmSchema.methods.isDue = function() {
  return new Date() >= this.time && this.isActive && !this.isCompleted;
};

// Mark alarm as completed
alarmSchema.methods.markCompleted = function() {
  this.isCompleted = true;
  this.completedAt = new Date();
  return this.save();
};

// Ensure virtual fields are serialized
alarmSchema.set('toJSON', { virtuals: true });
alarmSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Alarm', alarmSchema);
