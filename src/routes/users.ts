import express from 'express';
import userRepository from '../repositories/userRepository';
import { authenticate } from '../middleware/auth';
import auditService from '../services/auditService';

const router = express.Router();

/**
 * GET /api/users/me
 * Get current user's profile
 */
router.get('/me', authenticate, (req, res) => {
  try {
    const userId = req.user!.id;
    const user = userRepository.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ error: error.message || 'Failed to get user' });
  }
});

/**
 * GET /api/users/:userId
 * Get user profile (secured - users can only access their own profile)
 */
router.get('/:userId', authenticate, (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user!.id;
    
    // Ensure user can only access their own profile
    if (userId !== authenticatedUserId) {
      return res.status(403).json({ error: 'Forbidden: Cannot access other users\' profiles' });
    }
    
    const user = userRepository.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ error: error.message || 'Failed to get user' });
  }
});

/**
 * PUT /api/users/:userId
 * Update user profile
 */
router.put('/:userId', authenticate, (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user!.id;
    
    // Ensure user can only update their own profile
    if (userId !== authenticatedUserId) {
      return res.status(403).json({ error: 'Forbidden: Cannot update other users\' profiles' });
    }
    
    const userData = { ...req.body, user_id: userId };
    
    const existingUser = userRepository.getUser(userId);
    if (existingUser) {
      userRepository.updateUser(userData);
    } else {
      userRepository.createUser(userData);
    }
    
    // Log audit trail
    auditService.logProfileUpdate(
      userId,
      { fields_updated: Object.keys(req.body) },
      req.user!.email
    );
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Update user error:', error);
    res.status(500).json({ error: error.message || 'Failed to update user' });
  }
});

/**
 * POST /api/users/profile/log-update
 * Log a profile update to audit trail (for Supabase auth updates)
 */
router.post('/profile/log-update', authenticate, (req, res) => {
  try {
    const userId = req.user!.id;
    const { details } = req.body;
    
    // Log the profile update
    auditService.logProfileUpdate(
      userId,
      details || { fields_updated: ['profile'] },
      req.user!.email
    );
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error logging profile update:', error);
    res.status(500).json({ error: error.message || 'Failed to log profile update' });
  }
});

/**
 * GET /api/users/:userId/stats
 * Get user statistics
 */
router.get('/:userId/stats', authenticate, (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user!.id;
    
    // Ensure user can only access their own stats
    if (userId !== authenticatedUserId) {
      return res.status(403).json({ error: 'Forbidden: Cannot access other users\' statistics' });
    }
    
    const stats = userRepository.getUserStats(userId);
    res.json({ stats });
  } catch (error: any) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to get stats' });
  }
});

export default router;
