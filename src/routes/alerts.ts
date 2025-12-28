import express from 'express';
import alertRepository from '../repositories/alertRepository';
import goalRepository from '../repositories/goalRepository';
import notificationService from '../services/notificationService';
import { authenticate } from '../middleware/auth';

const router = express.Router();

/**
 * GET /api/alerts/:userId
 * Get all active alerts for a user
 */
router.get('/:userId', authenticate, (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user!.id;
    
    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot access other users\' alerts'
      });
    }

    const includeRead = req.query.includeRead === 'true';
    const includeDismissed = req.query.includeDismissed === 'true';

    const alerts = alertRepository.getAlerts(userId, includeRead, includeDismissed);

    res.json({
      success: true,
      alerts
    });
  } catch (error: any) {
    console.error('Get alerts error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get alerts'
    });
  }
});

/**
 * POST /api/alerts/:id/read
 * Mark an alert as read
 */
router.post('/:id/read', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const authenticatedUserId = req.user!.id;
    
    // Verify ownership
    const alerts = alertRepository.getAlerts(authenticatedUserId, true, true);
    const alert = alerts.find(a => a.id === parseInt(id));
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found or access denied'
      });
    }

    alertRepository.markAlertAsRead(parseInt(id));

    res.json({
      success: true,
      message: 'Alert marked as read'
    });
  } catch (error: any) {
    console.error('Mark alert read error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark alert as read'
    });
  }
});

/**
 * POST /api/alerts/:id/dismiss
 * Dismiss an alert
 */
router.post('/:id/dismiss', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const authenticatedUserId = req.user!.id;
    
    // Verify ownership
    const alerts = alertRepository.getAlerts(authenticatedUserId, true, true);
    const alert = alerts.find(a => a.id === parseInt(id));
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found or access denied'
      });
    }

    alertRepository.dismissAlert(parseInt(id));

    res.json({
      success: true,
      message: 'Alert dismissed'
    });
  } catch (error: any) {
    console.error('Dismiss alert error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to dismiss alert'
    });
  }
});

/**
 * GET /api/alerts/:userId/anomalies
 * Get detected anomalies
 */
router.get('/:userId/anomalies', authenticate, (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user!.id;
    
    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot access other users\' anomalies'
      });
    }

    const includeReviewed = req.query.includeReviewed === 'true';
    const anomalies = alertRepository.getAnomalies(userId, includeReviewed);

    res.json({
      success: true,
      anomalies
    });
  } catch (error: any) {
    console.error('Get anomalies error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get anomalies'
    });
  }
});

/**
 * POST /api/alerts/anomalies/:id/review
 * Mark anomaly as reviewed
 */
router.post('/anomalies/:id/review', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const { isFalsePositive } = req.body;
    const authenticatedUserId = req.user!.id;
    
    // Verify ownership
    const anomalies = alertRepository.getAnomalies(authenticatedUserId, true);
    const anomaly = anomalies.find(a => a.id === parseInt(id));
    
    if (!anomaly) {
      return res.status(404).json({
        success: false,
        error: 'Anomaly not found or access denied'
      });
    }

    alertRepository.markAnomalyAsReviewed(parseInt(id), isFalsePositive || false);

    res.json({
      success: true,
      message: 'Anomaly marked as reviewed'
    });
  } catch (error: any) {
    console.error('Review anomaly error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to review anomaly'
    });
  }
});

/**
 * GET /api/alerts/:userId/digest
 * Get daily financial digest
 */
router.get('/:userId/digest', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user!.id;
    
    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot access other users\' digest'
      });
    }

    const digest = await notificationService.generateDailyDigest(userId);

    res.json({
      success: true,
      digest
    });
  } catch (error: any) {
    console.error('Daily digest error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate daily digest'
    });
  }
});

/**
 * POST /api/alerts/:userId/monitor
 * Run all monitoring tasks
 */
router.post('/:userId/monitor', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user!.id;
    
    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot run monitoring for other users'
      });
    }

    await notificationService.runAllMonitoring(userId);

    res.json({
      success: true,
      message: 'Monitoring completed'
    });
  } catch (error: any) {
    console.error('Monitoring error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to run monitoring'
    });
  }
});

/**
 * GET /api/alerts/:userId/goals
 * Get goal progress
 */
router.get('/:userId/goals', authenticate, (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user!.id;
    
    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot access other users\' goals'
      });
    }

    const goalProgress = goalRepository.getGoalProgress(userId);

    res.json({
      success: true,
      goals: goalProgress
    });
  } catch (error: any) {
    console.error('Goal progress error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get goal progress'
    });
  }
});

/**
 * GET /api/alerts/:userId/recurring
 * Get recurring transactions
 */
router.get('/:userId/recurring', authenticate, (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user!.id;
    
    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot access other users\' recurring transactions'
      });
    }

    const recurring = alertRepository.getRecurringTransactions(userId);

    res.json({
      success: true,
      recurring
    });
  } catch (error: any) {
    console.error('Get recurring error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get recurring transactions'
    });
  }
});

export default router;
