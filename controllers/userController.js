const { validationResult } = require('express-validator');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Alarm = require('../models/Alarm');

// Get user dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user's chat statistics
    const chatStats = await Chat.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: null,
          totalChats: { $sum: 1 },
          activeChats: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          resolvedChats: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
          totalMessages: { $sum: '$metadata.totalMessages' },
          averageRating: { $avg: '$review.rating' },
          recentResolved: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'resolved'] },
                    { $gte: ['$updatedAt', new Date(Date.now() - 24 * 60 * 60 * 1000)] } // Last 24 hours
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const stats = chatStats[0] || {
      totalChats: 0,
      activeChats: 0,
      resolvedChats: 0,
      totalMessages: 0,
      averageRating: null,
      recentResolved: 0
    };

    // Calculate average response time (mock for now - would need message timestamps)
    const avgResponseTime = stats.totalMessages > 0 ? '< 2min' : 'N/A';

    // Get recent chats
    const recentChats = await Chat.find({ userId })
      .select('title issue status category createdAt updatedAt metadata.lastActivity review.rating')
      .sort({ 'metadata.lastActivity': -1 })
      .limit(5);

    // Get user insights based on their activity
    const insights = generateUserInsights(stats, recentChats);

    // Check for pending chat ratings
    const chatsNeedingRating = await Chat.find({
      userId,
      status: 'resolved',
      'review.rating': { $exists: false }
    }).select('title _id').limit(3);

    res.json({
      success: true,
      data: {
        stats: {
          totalChats: stats.totalChats,
          activeChats: stats.activeChats,
          resolvedChats: stats.resolvedChats,
          averageRating: stats.averageRating,
          recentResolved: stats.recentResolved,
          avgResponseTime
        },
        recentChats,
        insights,
        pendingRatings: chatsNeedingRating
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching dashboard statistics'
    });
  }
};

// Generate personalized insights based on user activity
const generateUserInsights = (stats, recentChats) => {
  const insights = [];

  // Care tip based on activity
  if (stats.totalChats > 10) {
    insights.push({
      type: 'progress',
      icon: 'trending-up',
      title: 'Great Progress!',
      content: 'You\'ve engaged in many conversations. Your proactive approach to care is commendable!'
    });
  } else if (stats.totalChats === 0) {
    insights.push({
      type: 'welcome',
      icon: 'heart',
      title: 'Welcome to CareEase!',
      content: 'Start a conversation to get personalized care assistance tailored to your needs.'
    });
  }

  // Rating-based insight
  if (stats.averageRating && stats.averageRating >= 4.5) {
    insights.push({
      type: 'rating',
      icon: 'star',
      title: 'Excellent Experience',
      content: 'Your high ratings show you\'re receiving quality care assistance. Keep up the great feedback!'
    });
  } else if (stats.averageRating && stats.averageRating < 3.0) {
    insights.push({
      type: 'improvement',
      icon: 'shield',
      title: 'Room for Improvement',
      content: 'We\'re always working to improve. Your feedback helps us provide better care.'
    });
  }

  // Activity-based insight
  if (stats.activeChats > 3) {
    insights.push({
      type: 'activity',
      icon: 'activity',
      title: 'Active Care Management',
      content: 'You have several active conversations. Consider resolving some to maintain focus.'
    });
  }

  // Default insights if none generated
  if (insights.length === 0) {
    insights.push(
      {
        type: 'tip',
        icon: 'heart',
        title: 'Daily Care Tip',
        content: 'Regular social interaction can significantly improve mental health in elderly care.'
      },
      {
        type: 'reminder',
        icon: 'shield',
        title: 'Safety First',
        content: 'Ensure all medications are stored in a cool, dry place and check expiration dates regularly.'
      }
    );
  }

  return insights.slice(0, 3); // Return max 3 insights
};

// Create a new alarm/reminder
const createAlarm = async (req, res) => {
  try {
    const { name, time, description } = req.body;
    const userId = req.user._id;

    const alarm = new Alarm({
      userId,
      name,
      time: new Date(time),
      description,
      isActive: true
    });

    await alarm.save();

    res.json({
      success: true,
      message: 'Alarm created successfully',
      data: { alarm }
    });
  } catch (error) {
    console.error('Create alarm error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating alarm'
    });
  }
};

// Get user's alarms
const getUserAlarms = async (req, res) => {
  try {
    const userId = req.user._id;

    // Auto-deactivate overdue alarms
    await Alarm.updateMany(
      { userId, time: { $lt: new Date() }, isActive: true },
      { $set: { isActive: false } }
    );

    const alarms = await Alarm.find({ userId })
      .sort({ time: 1 });

    res.json({
      success: true,
      data: { alarms }
    });
  } catch (error) {
    console.error('Get user alarms error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching alarms'
    });
  }
};

// Update alarm
const updateAlarm = async (req, res) => {
  try {
    const { alarmId } = req.params;
    const { name, time, description, isActive } = req.body;
    const userId = req.user._id;

    const alarm = await Alarm.findOne({ _id: alarmId, userId });

    if (!alarm) {
      return res.status(404).json({
        success: false,
        message: 'Alarm not found'
      });
    }

    if (name) alarm.name = name;
    if (time) alarm.time = new Date(time);
    if (description !== undefined) alarm.description = description;
    if (isActive !== undefined) alarm.isActive = isActive;

    await alarm.save();

    res.json({
      success: true,
      message: 'Alarm updated successfully',
      data: { alarm }
    });
  } catch (error) {
    console.error('Update alarm error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating alarm'
    });
  }
};

// Delete alarm
const deleteAlarm = async (req, res) => {
  try {
    const { alarmId } = req.params;
    const userId = req.user._id;

    const alarm = await Alarm.findOneAndDelete({ _id: alarmId, userId });

    if (!alarm) {
      return res.status(404).json({
        success: false,
        message: 'Alarm not found'
      });
    }

    res.json({
      success: true,
      message: 'Alarm deleted successfully'
    });
  } catch (error) {
    console.error('Delete alarm error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting alarm'
    });
  }
};

// Get pending chat ratings for notifications
const getPendingRatings = async (req, res) => {
  try {
    const userId = req.user._id;

    const pendingChats = await Chat.find({
      userId,
      status: 'resolved',
      'review.rating': { $exists: false }
    }).select('title _id createdAt').limit(5);

    res.json({
      success: true,
      data: { pendingChats }
    });
  } catch (error) {
    console.error('Get pending ratings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching pending ratings'
    });
  }
};

module.exports = {
  getDashboardStats,
  createAlarm,
  getUserAlarms,
  updateAlarm,
  deleteAlarm,
  getPendingRatings
};
