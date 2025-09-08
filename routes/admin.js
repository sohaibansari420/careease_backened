const express = require('express');
const { body } = require('express-validator');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiter');
const {
  getAllUsers,
  getUserDetails,
  toggleUserBan,
  getAllChats,
  getChatDetails,
  getUserChatHistory,
  getReports,
  updateReport,
  getDashboardAnalytics
} = require('../controllers/adminController');

const router = express.Router();

// Apply admin authentication to all routes
router.use(authenticateToken, requireAdmin, generalLimiter);

// Validation rules
const toggleUserBanValidation = [
  body('banned')
    .isBoolean()
    .withMessage('Banned status must be a boolean'),
  body('banReason')
    .if(body('banned').equals(true))
    .isLength({ min: 1, max: 500 })
    .withMessage('Ban reason is required when banning a user and must be less than 500 characters')
    .trim()
];

const updateReportValidation = [
  body('status')
    .optional()
    .isIn(['pending', 'investigating', 'resolved', 'dismissed'])
    .withMessage('Invalid status'),
  body('adminNotes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Admin notes must be less than 1000 characters')
    .trim()
];

// Dashboard routes
router.get('/dashboard/analytics', getDashboardAnalytics);

// User management routes
router.get('/users', getAllUsers);
router.get('/users/:userId', getUserDetails);
router.put('/users/:userId/ban', toggleUserBanValidation, toggleUserBan);

// Chat management routes
router.get('/chats', getAllChats);
router.get('/chats/:chatId', getChatDetails);
router.get('/users/:userId/chats', getUserChatHistory);

// Report management routes
router.get('/reports', getReports);
router.put('/reports/:reportId', updateReportValidation, updateReport);

module.exports = router;
