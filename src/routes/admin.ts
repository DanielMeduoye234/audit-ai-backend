import express from 'express';
import userRepository from '../repositories/userRepository';
import { authenticate } from '../middleware/auth';

const router = express.Router();

/**
 * GET /api/admin/stats
 * Get high-level user statistics
 */
router.get('/stats', authenticate, (req, res) => {
  try {
    const stats = userRepository.getAdminStats();
    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

/**
 * GET /api/admin/users
 * List all registered users
 */
router.get('/users', authenticate, (req, res) => {
  try {
    const users = userRepository.getAllUsers();
    res.json({
      success: true,
      users
    });
  } catch (error: any) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;
