import express from 'express';

// Minimal oauth router to prevent import errors
const router = express.Router();

// Basic health check
router.get('/health', (req, res) => {
  res.json({ status: 'minimal oauth router active' });
});

export default router;