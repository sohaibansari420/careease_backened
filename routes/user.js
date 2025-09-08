const express = require('express');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiter');
const {
  getDashboardStats,
  createAlarm,
  getUserAlarms,
  updateAlarm,
  deleteAlarm,
  getPendingRatings
} = require('../controllers/userController');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken, generalLimiter);

// Validation rules
const createAlarmValidation = [
  body('name')
    .isLength({ min: 1, max: 100 })
    .withMessage('Alarm name is required and must be less than 100 characters')
    .trim(),
  body('time')
    .isISO8601()
    .withMessage('Valid time is required'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters')
    .trim()
];

const updateAlarmValidation = [
  body('name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Alarm name must be less than 100 characters')
    .trim(),
  body('time')
    .optional()
    .isISO8601()
    .withMessage('Valid time is required'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters')
    .trim(),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

// Dashboard routes
router.get('/dashboard', getDashboardStats);

// Alarm routes
router.post('/alarms', createAlarmValidation, createAlarm);
router.get('/alarms', getUserAlarms);
router.put('/alarms/:alarmId', updateAlarmValidation, updateAlarm);
router.delete('/alarms/:alarmId', deleteAlarm);

// Rating notifications
router.get('/pending-ratings', getPendingRatings);

module.exports = router;
