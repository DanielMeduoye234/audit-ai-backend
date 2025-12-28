import express from 'express';
import transactionRepository from '../repositories/transactionRepository';
import db from '../database/db';

const router = express.Router();

/**
 * GET /api/search
 * Global search across transactions, notifications, etc.
 */
router.get('/', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.json({ results: [] });
    }

    const query = q.toLowerCase();
    const results: any[] = [];

    // Search transactions
    const transactions = db.prepare(`
      SELECT * FROM transactions 
      WHERE LOWER(description) LIKE ? 
      OR LOWER(category) LIKE ?
      LIMIT 10
    `).all(`%${query}%`, `%${query}%`);

    transactions.forEach((t: any) => {
      results.push({
        title: t.description,
        subtitle: `${t.category} • $${Math.abs(t.amount)}`,
        path: '/transactions',
        icon: '💰',
        type: 'transaction'
      });
    });

    // Search notifications
    const notifications = db.prepare(`
      SELECT * FROM notifications 
      WHERE LOWER(title) LIKE ? 
      OR LOWER(message) LIKE ?
      LIMIT 5
    `).all(`%${query}%`, `%${query}%`);

    notifications.forEach((n: any) => {
      results.push({
        title: n.title,
        subtitle: n.message.substring(0, 50) + '...',
        path: '/notifications',
        icon: '🔔',
        type: 'notification'
      });
    });

    res.json({ results });
  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message || 'Search failed' });
  }
});

export default router;
