import express from 'express';
import budgetRepository, { Budget } from '../repositories/budgetRepository';
import { authenticate } from '../middleware/auth';

const router = express.Router();

/**
 * GET /api/budgets/:userId
 * Get all budgets for a user
 */
router.get('/:userId', authenticate, (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user!.id;
    
    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot access other users\' budgets'
      });
    }

    const budgets = budgetRepository.getBudgets(userId);

    res.json({
      success: true,
      budgets
    });
  } catch (error: any) {
    console.error('Get budgets error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get budgets'
    });
  }
});

/**
 * GET /api/budgets/:userId/active
 * Get active budgets for a user
 */
router.get('/:userId/active', authenticate, (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user!.id;
    
    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot access other users\' budgets'
      });
    }

    const budgets = budgetRepository.getActiveBudgets(userId);

    res.json({
      success: true,
      budgets
    });
  } catch (error: any) {
    console.error('Get active budgets error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get active budgets'
    });
  }
});

/**
 * POST /api/budgets
 * Create a new budget
 */
router.post('/', authenticate, (req, res) => {
  try {
    const budget: Budget = req.body;
    const authenticatedUserId = req.user!.id;

    if (!budget.category || !budget.amount || !budget.period || !budget.start_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: category, amount, period, start_date'
      });
    }

    // Override user_id with authenticated user
    budget.user_id = authenticatedUserId;

    const budgetId = budgetRepository.createBudget(budget);

    res.json({
      success: true,
      budgetId,
      message: 'Budget created successfully'
    });
  } catch (error: any) {
    console.error('Create budget error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create budget'
    });
  }
});

/**
 * PUT /api/budgets/:id
 * Update a budget
 */
router.put('/:id', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const authenticatedUserId = req.user!.id;
    
    // Verify ownership
    const existingBudgets = budgetRepository.getBudgets(authenticatedUserId);
    const existingBudget = existingBudgets.find(b => b.id === parseInt(id));
    
    if (!existingBudget) {
      return res.status(404).json({
        success: false,
        error: 'Budget not found or access denied'
      });
    }

    const budget: Budget = { ...req.body, id: parseInt(id), user_id: authenticatedUserId };
    budgetRepository.updateBudget(budget);

    res.json({
      success: true,
      message: 'Budget updated successfully'
    });
  } catch (error: any) {
    console.error('Update budget error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update budget'
    });
  }
});

/**
 * DELETE /api/budgets/:id
 * Delete a budget
 */
router.delete('/:id', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const authenticatedUserId = req.user!.id;
    
    // Verify ownership
    const existingBudgets = budgetRepository.getBudgets(authenticatedUserId);
    const existingBudget = existingBudgets.find(b => b.id === parseInt(id));
    
    if (!existingBudget) {
      return res.status(404).json({
        success: false,
        error: 'Budget not found or access denied'
      });
    }

    budgetRepository.deleteBudget(parseInt(id));

    res.json({
      success: true,
      message: 'Budget deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete budget error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete budget'
    });
  }
});

/**
 * GET /api/budgets/:userId/variance
 * Get budget variance report
 */
router.get('/:userId/variance', authenticate, (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user!.id;
    
    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot access other users\' budget variance'
      });
    }

    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }

    const variances = budgetRepository.getBudgetVariance(userId, startDate, endDate);

    res.json({
      success: true,
      variances
    });
  } catch (error: any) {
    console.error('Budget variance error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get budget variance'
    });
  }
});

/**
 * GET /api/budgets/:userId/alerts
 * Get budget alerts (overruns and warnings)
 */
router.get('/:userId/alerts', authenticate, (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user!.id;
    
    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot access other users\' budget alerts'
      });
    }

    const alerts = budgetRepository.checkBudgetAlerts(userId);

    res.json({
      success: true,
      alerts
    });
  } catch (error: any) {
    console.error('Budget alerts error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get budget alerts'
    });
  }
});

export default router;
