const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Report = require('../models/Report');

// Get all users with pagination and filters
const getAllUsers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      role, 
      status, 
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;

    // Build query
    const query = {};
    
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) query.role = role;
    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;
    if (status === 'banned') query.isBanned = true;

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const users = await User.find(query)
      .select('-password')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    // Get user statistics
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
          bannedUsers: { $sum: { $cond: ['$isBanned', 1, 0] } },
          adminUsers: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        },
        stats: stats[0] || {
          totalUsers: 0,
          activeUsers: 0,
          bannedUsers: 0,
          adminUsers: 0
        }
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching users'
    });
  }
};

// Get user details
const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's chat statistics
    const chatStats = await Chat.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: null,
          totalChats: { $sum: 1 },
          activeChats: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          resolvedChats: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
          totalMessages: { $sum: '$metadata.totalMessages' },
          averageRating: { $avg: '$review.rating' }
        }
      }
    ]);

    // Get recent chats
    const recentChats = await Chat.find({ userId: user._id })
      .select('title issue category status createdAt metadata.lastActivity')
      .sort({ 'metadata.lastActivity': -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        user,
        chatStats: chatStats[0] || {
          totalChats: 0,
          activeChats: 0,
          resolvedChats: 0,
          totalMessages: 0,
          averageRating: null
        },
        recentChats
      }
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching user details'
    });
  }
};

// Ban/unban user
const toggleUserBan = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { userId } = req.params;
    const { banned, banReason } = req.body;

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent banning other admins
    if (user.role === 'admin' && banned) {
      return res.status(403).json({
        success: false,
        message: 'Cannot ban admin users'
      });
    }

    user.isBanned = banned;
    user.banReason = banned ? banReason : null;
    
    await user.save();

    res.json({
      success: true,
      message: `User ${banned ? 'banned' : 'unbanned'} successfully`,
      data: { user: user.toJSON() }
    });
  } catch (error) {
    console.error('Toggle user ban error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating user ban status'
    });
  }
};

// Get all chats (admin view)
const getAllChats = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      userId, 
      category, 
      status, 
      priority,
      search 
    } = req.query;

    // Build query
    const query = {};
    
    if (userId) query.userId = userId;
    if (category) query.category = category;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { issue: { $regex: search, $options: 'i' } }
      ];
    }

    const chats = await Chat.find(query)
      .populate('userId', 'username email firstName lastName')
      .select('-messages') // Don't include full message content
      .sort({ 'metadata.lastActivity': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Chat.countDocuments(query);

    // Get chat statistics
    const stats = await Chat.aggregate([
      {
        $group: {
          _id: null,
          totalChats: { $sum: 1 },
          activeChats: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          resolvedChats: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
          averageRating: { $avg: '$review.rating' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        chats,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        },
        stats: stats[0] || {
          totalChats: 0,
          activeChats: 0,
          resolvedChats: 0,
          averageRating: null
        }
      }
    });
  } catch (error) {
    console.error('Get all chats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching chats'
    });
  }
};

// Get specific chat details (admin view)
const getChatDetails = async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId)
      .populate('userId', 'username email firstName lastName');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    res.json({
      success: true,
      data: { chat }
    });
  } catch (error) {
    console.error('Get chat details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching chat details'
    });
  }
};

// Get user chat history (admin view)
const getUserChatHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      page = 1,
      limit = 20,
      status,
      category,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = { userId };

    if (status) query.status = status;
    if (category) query.category = category;

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const chats = await Chat.find(query)
      .select('title issue category status priority createdAt messages metadata review')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Chat.countDocuments(query);

    // Get chat statistics for this user
    const chatStats = await Chat.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalChats: { $sum: 1 },
          activeChats: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          resolvedChats: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
          totalMessages: { $sum: '$metadata.totalMessages' },
          averageRating: { $avg: '$review.rating' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        chats,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        },
        stats: chatStats[0] || {
          totalChats: 0,
          activeChats: 0,
          resolvedChats: 0,
          totalMessages: 0,
          averageRating: null
        }
      }
    });
  } catch (error) {
    console.error('Get user chat history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching user chat history'
    });
  }
};

// Get reports
const getReports = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      reportType, 
      severity 
    } = req.query;

    // Build query
    const query = {};
    
    if (status) query.status = status;
    if (reportType) query.reportType = reportType;
    if (severity) query.severity = severity;

    const reports = await Report.find(query)
      .populate('userId', 'username email firstName lastName')
      .populate('chatId', 'title issue category')
      .populate('resolvedBy', 'username')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Report.countDocuments(query);

    res.json({
      success: true,
      data: {
        reports,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching reports'
    });
  }
};

// Update report status
const updateReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, adminNotes } = req.body;

    const report = await Report.findById(reportId);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    if (status) report.status = status;
    if (adminNotes) report.adminNotes = adminNotes;
    
    if (status === 'resolved') {
      report.resolvedBy = req.user._id;
      report.resolvedAt = new Date();
    }

    await report.save();

    res.json({
      success: true,
      message: 'Report updated successfully',
      data: { report }
    });
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating report'
    });
  }
};

// Get dashboard analytics
const getDashboardAnalytics = async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (timeframe) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get user analytics
    const userAnalytics = await User.aggregate([
      {
        $facet: {
          total: [{ $count: "count" }],
          new: [
            { $match: { createdAt: { $gte: startDate } } },
            { $count: "count" }
          ],
          active: [
            { $match: { isActive: true } },
            { $count: "count" }
          ],
          banned: [
            { $match: { isBanned: true } },
            { $count: "count" }
          ]
        }
      }
    ]);

    // Get chat analytics
    const chatAnalytics = await Chat.aggregate([
      {
        $facet: {
          total: [{ $count: "count" }],
          new: [
            { $match: { createdAt: { $gte: startDate } } },
            { $count: "count" }
          ],
          active: [
            { $match: { status: 'active' } },
            { $count: "count" }
          ],
          resolved: [
            { $match: { status: 'resolved' } },
            { $count: "count" }
          ],
          averageRating: [
            { $match: { 'review.rating': { $exists: true } } },
            { $group: { _id: null, avgRating: { $avg: '$review.rating' } } }
          ]
        }
      }
    ]);

    // Get daily chat creation trend
    const chatTrend = await Chat.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        users: {
          total: userAnalytics[0].total[0]?.count || 0,
          new: userAnalytics[0].new[0]?.count || 0,
          active: userAnalytics[0].active[0]?.count || 0,
          banned: userAnalytics[0].banned[0]?.count || 0
        },
        chats: {
          total: chatAnalytics[0].total[0]?.count || 0,
          new: chatAnalytics[0].new[0]?.count || 0,
          active: chatAnalytics[0].active[0]?.count || 0,
          resolved: chatAnalytics[0].resolved[0]?.count || 0,
          averageRating: chatAnalytics[0].averageRating[0]?.avgRating || null
        },
        trends: {
          chatCreation: chatTrend
        }
      }
    });
  } catch (error) {
    console.error('Get dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching analytics'
    });
  }
};

module.exports = {
  getAllUsers,
  getUserDetails,
  toggleUserBan,
  getAllChats,
  getChatDetails,
  getUserChatHistory,
  getReports,
  updateReport,
  getDashboardAnalytics
};
