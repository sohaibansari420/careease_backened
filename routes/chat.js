const express = require('express');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { chatLimiter, aiChatLimiter } = require('../middleware/rateLimiter');
const {
  createChat,
  getUserChats,
  getChat,
  sendMessage,
  updateChat,
  addReview,
  deleteChat
} = require('../controllers/chatController');

const router = express.Router();

// Validation rules
const createChatValidation = [
  body('title')
    .isLength({ min: 1, max: 100 })
    .withMessage('Title is required and must be less than 100 characters')
    .trim(),
  body('issue')
    .isLength({ min: 10, max: 500 })
    .withMessage('Issue description must be between 10 and 500 characters')
    .trim(),
  body('category')
    .isIn(['health', 'medication', 'mobility', 'emotional', 'daily_care', 'emergency', 'other'])
    .withMessage('Invalid category'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority level')
];

const sendMessageValidation = [
  body('content')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message content is required and must be less than 1000 characters')
    .trim()
];

const updateChatValidation = [
  body('title')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be less than 100 characters')
    .trim(),
  body('status')
    .optional()
    .isIn(['active', 'resolved', 'archived'])
    .withMessage('Invalid status'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority level')
];

const addReviewValidation = [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('feedback')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Feedback must be less than 1000 characters')
    .trim()
];

// Routes
router.post('/', authenticateToken, chatLimiter, createChatValidation, createChat);
router.get('/', authenticateToken, getUserChats);
router.get('/:chatId', authenticateToken, getChat);
router.post('/:chatId/messages', authenticateToken, aiChatLimiter, sendMessageValidation, sendMessage);
router.put('/:chatId', authenticateToken, updateChatValidation, updateChat);
router.post('/:chatId/review', authenticateToken, addReviewValidation, addReview);
router.delete('/:chatId', authenticateToken, deleteChat);

module.exports = router;
