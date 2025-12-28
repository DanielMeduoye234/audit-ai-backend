import express from 'express';
import financialIntelligenceService from '../services/financialIntelligenceService';
import analyticsRepository from '../repositories/analyticsRepository';
import { authenticate } from '../middleware/auth';

const router = express.Router();

/**
 * GET /api/analytics/cash-flow/:userId
 * Get cash flow forecast
 */
router.get('/cash-flow/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user!.id;
    
    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot access other users\' analytics'
      });
    }

    const months = parseInt(req.query.months as string) || 3;
    const forecast = await financialIntelligenceService.forecastCashFlow(userId, months);

    res.json({
      success: true,
      forecast
    });
  } catch (error: any) {
    console.error('Cash flow forecast error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate cash flow forecast'
    });
  }
});

/**
 * GET /api/analytics/spending-patterns/:userId
 * Get spending analysis
 */
router.get('/spending-patterns/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user!.id;
    
    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot access other users\' analytics'
      });
    }

    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const patterns = analyticsRepository.getSpendingPatterns(userId, startDate, endDate);

    res.json({
      success: true,
      patterns
    });
  } catch (error: any) {
    console.error('Spending patterns error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze spending patterns'
    });
  }
});

/**
 * GET /api/analytics/trends/:userId
 * Get financial trends
 */
router.get('/trends/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user!.id;
    
    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot access other users\' analytics'
      });
    }

    const months = parseInt(req.query.months as string) || 6;
    const trends = analyticsRepository.getMonthlyTrends(userId, months);

    res.json({
      success: true,
      trends
    });
  } catch (error: any) {
    console.error('Trends error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get trends'
    });
  }
});

/**
 * POST /api/analytics/scenario
 * Simulate business scenario
 */
router.post('/scenario', authenticate, async (req, res) => {
  try {
    const { userId, scenario } = req.body;
    const authenticatedUserId = req.user!.id;

    if (!userId || !scenario) {
      return res.status(400).json({
        success: false,
        error: 'userId and scenario are required'
      });
    }

    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot simulate scenarios for other users'
      });
    }

    const result = await financialIntelligenceService.simulateScenario(userId, scenario);

    res.json({
      success: true,
      result
    });
  } catch (error: any) {
    console.error('Scenario simulation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to simulate scenario'
    });
  }
});

/**
 * GET /api/analytics/insights/:userId
 * Get proactive financial insights
 */
router.get('/insights/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user!.id;
    
    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot access other users\' insights'
      });
    }

    const insights = await financialIntelligenceService.generateInsights(userId);

    res.json({
      success: true,
      insights
    });
  } catch (error: any) {
    console.error('Insights error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate insights'
    });
  }
});

/**
 * GET /api/analytics/recurring/:userId
 * Detect recurring transactions
 */
router.get('/recurring/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user!.id;
    
    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot access other users\' data'
      });
    }

    const recurring = await financialIntelligenceService.detectRecurringPatterns(userId);

    res.json({
      success: true,
      recurring
    });
  } catch (error: any) {
    console.error('Recurring detection error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to detect recurring transactions'
    });
  }
});

/**
 * POST /api/analytics/detect-anomalies/:userId
 * Manually trigger anomaly detection
 */
router.post('/detect-anomalies/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user!.id;
    
    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot trigger anomaly detection for other users'
      });
    }

    await financialIntelligenceService.detectAnomalies(userId);

    res.json({
      success: true,
      message: 'Anomaly detection completed'
    });
  } catch (error: any) {
    console.error('Anomaly detection error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to detect anomalies'
    });
  }
});



/**
 * GET /api/analytics/briefing/:userId
 * Get Morning CFO Briefing
 */
router.get('/briefing/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user!.id; // Authenticated user
    
    if (userId !== authenticatedUserId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const briefing = await financialIntelligenceService.getDailyBriefing(userId);
    res.json({ success: true, briefing });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/runway/:userId
 * Get Cash Runway Analysis
 */
router.get('/runway/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user!.id;
    
    if (userId !== authenticatedUserId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const runway = await financialIntelligenceService.getRunwayAnalysis(userId);
    res.json({ success: true, runway });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
