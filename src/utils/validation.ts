import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('=== VALIDATION ERRORS ===');
    console.log('Request URL:', req.url);
    console.log('Request method:', req.method);
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Validation errors:', JSON.stringify(errors.array(), null, 2));
    console.log('========================');
    
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array(),
    });
  }
  next();
};

export const validateRegister = [
  body('email').isEmail().normalizeEmail(),
  body('displayName').trim().isLength({ min: 1, max: 50 }),
  body('timezone').optional().isString(),
];

export const validateLogin = [
  body('email').isEmail().normalizeEmail(),
];

export const validateGroup = [
  body('name').trim().isLength({ min: 1, max: 100 }),
  body('maxMembers').optional().isInt({ min: 3, max: 20 }),
];

export const validateSubmission = [
  body('songId').isString().notEmpty(),
  body('comment').optional().trim().isLength({ max: 200 }),
];