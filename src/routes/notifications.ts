import express from 'express';
import notificationRepository from '../repositories/notificationRepository';

const router = express.Router();

/**
 * GET /api/notifications/:userId
 * Get all notifications for a user
 */
router.get('/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const notifications = notificationRepository.getNotifications(userId, limit);
    res.json({ notifications });
  } catch (error: any) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: error.message || 'Failed to get notifications' });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a notification as read
 */
router.patch('/:id/read', (req, res) => {
  try {
    const { id } = req.params;
    notificationRepository.markAsRead(parseInt(id));
    res.json({ success: true });
  } catch (error: any) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: error.message || 'Failed to mark as read' });
  }
});

/**
 * GET /api/notifications/:userId/unread-count
 * Get unread notification count for a user
 */
router.get('/:userId/unread-count', (req, res) => {
  try {
    const { userId } = req.params;
    const count = notificationRepository.getUnreadCount(userId);
    res.json({ count });
  } catch (error: any) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: error.message || 'Failed to get unread count' });
  }
});

export default router;
