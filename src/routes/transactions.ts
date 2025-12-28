import express from 'express';
import transactionRepository from '../repositories/transactionRepository';
import notificationRepository from '../repositories/notificationRepository';
import { authenticate } from '../middleware/auth';
import auditService from '../services/auditService';

const router = express.Router();

/**
 * GET /api/transactions
 * Get all transactions for the authenticated user
 */
router.get('/', authenticate, (req, res) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 1000;
    
    const transactions = transactionRepository.getRecentTransactions(userId, limit);
    res.json({ transactions });
  } catch (error: any) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: error.message || 'Failed to get transactions' });
  }
});

/**
 * GET /api/transactions/:userId
 * Get all transactions for a specific user (legacy endpoint, now secured)
 */
router.get('/:userId', authenticate, (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user!.id;
    
    console.log('📊 GET /transactions/:userId');
    console.log('   Requested userId:', userId);
    console.log('   Authenticated userId:', authenticatedUserId);
    
    // Ensure user can only access their own transactions
    if (userId !== authenticatedUserId) {
      console.error('❌ User ID mismatch!');
      return res.status(403).json({ error: 'Forbidden: Cannot access other users\' transactions' });
    }
    
    const limit = parseInt(req.query.limit as string) || 1000;
    const transactions = transactionRepository.getRecentTransactions(userId, limit);
    console.log('✅ Returning', transactions.length, 'transactions');
    res.json({ transactions });
  } catch (error: any) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: error.message || 'Failed to get transactions' });
  }
});

/**
 * GET /api/transactions/summary/:userId
 * Get financial summary (revenue, expenses, profit) for a specific user
 */
router.get('/summary/:userId', authenticate, (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user!.id;
    
    if (userId !== authenticatedUserId) {
      return res.status(403).json({ error: 'Forbidden: Cannot access other users\' summary' });
    }
    
    const summary = transactionRepository.getFinancialSummary(userId);
    res.json(summary);
  } catch (error: any) {
    console.error('Get summary error:', error);
    res.status(500).json({ error: error.message || 'Failed to get summary' });
  }
});

/**
 * POST /api/transactions
 * Create a new transaction
 */
router.post('/', authenticate, (req, res) => {
  try {
    const transaction = req.body;
    const authenticatedUserId = req.user!.id;
    
    // Override user_id with authenticated user to prevent spoofing
    transaction.user_id = authenticatedUserId;
    
    const id = transactionRepository.addTransaction(transaction);
    
    // Log audit trail
    auditService.logTransactionCreate(
      authenticatedUserId,
      id.toString(),
      { description: transaction.description, amount: transaction.amount, category: transaction.category },
      req.user!.email
    );

    // Create notification
    notificationRepository.createNotification({
      user_id: authenticatedUserId,
      title: 'New Transaction',
      message: `Added ${transaction.type}: ${transaction.description} - $${transaction.amount}`,
      type: 'success'
    });
    
    res.json({ success: true, id });
  } catch (error: any) {
    console.error('Create transaction error:', error);
    res.status(500).json({ error: error.message || 'Failed to create transaction' });
  }
});

/**
 * PUT /api/transactions/:id
 * Update a transaction
 */
router.put('/:id', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const authenticatedUserId = req.user!.id;
    
    // Verify ownership before updating
    const existingTransaction = transactionRepository.getAllTransactions(authenticatedUserId)
      .find(t => t.id === parseInt(id));
    
    if (!existingTransaction) {
      return res.status(404).json({ error: 'Transaction not found or access denied' });
    }
    
    const transaction = { ...req.body, id: parseInt(id), user_id: authenticatedUserId };
    transactionRepository.updateTransaction(transaction);
    
    // Log audit trail
    auditService.logTransactionUpdate(
      authenticatedUserId,
      id,
      { description: transaction.description, amount: transaction.amount, category: transaction.category },
      req.user!.email
    );
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Update transaction error:', error);
    res.status(500).json({ error: error.message || 'Failed to update transaction' });
  }
});

/**
 * DELETE /api/transactions/:id
 * Delete a transaction
 */
router.delete('/:id', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const authenticatedUserId = req.user!.id;
    
    // Verify ownership before deleting
    const existingTransaction = transactionRepository.getAllTransactions(authenticatedUserId)
      .find(t => t.id === parseInt(id));
    
    if (!existingTransaction) {
      return res.status(404).json({ error: 'Transaction not found or access denied' });
    }
    
    transactionRepository.deleteTransaction(parseInt(id));
    
    // Log audit trail
    auditService.logTransactionDelete(
      authenticatedUserId,
      id,
      { description: existingTransaction.description, amount: existingTransaction.amount },
      req.user!.email
    );
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete transaction' });
  }
});

export default router;
