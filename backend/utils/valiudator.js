// utils/validator.js
const { body, param, query, validationResult } = require('express-validator');
const { ApiError } = require('../middleware/errorHandler');

// Common validation chains
const validators = {
  username: () => 
    body('username')
      .isLength({ min: 3, max: 20 })
      .withMessage('Username must be 3-20 characters')
      .matches(/^[A-Za-z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers and underscores')
      .trim(),
  
  email: () =>
    body('email')
      .isEmail()
      .withMessage('Invalid email address')
      .normalizeEmail(),
  
  password: () =>
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  eventId: () =>
    param('id')
      .isMongoId()
      .withMessage('Invalid event ID format'),
  
  betAmount: () =>
    body('amount')
      .isInt({ min: 10 })
      .withMessage('Bet amount must be at least 10 coins')
};

// Validation middleware
const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const extractedErrors = [];
    errors.array().map(err => extractedErrors.push({ [err.param]: err.msg }));

    throw new ApiError('Validation Error', 400, 'ERR_VALIDATION', extractedErrors);
  };
};

module.exports = {
  validators,
  validate
};