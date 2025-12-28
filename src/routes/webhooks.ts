
import express from 'express';
import transactionRepository from '../repositories/transactionRepository';
import notificationRepository from '../repositories/notificationRepository';

const router = express.Router();

// Helper to get user ID from query or header
const getUserId = (req: express.Request): string | null => {
  if (req.query.userId) return req.query.userId as string;
  if (req.headers['x-user-id']) return req.headers['x-user-id'] as string;
  return null; // Fail if no user identified
};

/**
 * POST /api/webhooks/shopify
 * Handle Shopify 'orders/create' or 'orders/paid' webhook
 */
router.post('/shopify', (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }

    const order = req.body;
    
    // Basic deduplication check (optional, but good practice)
    // In a real app, store external_id in DB. Here we just rely on description unique-ishness or just add it.

    const transaction = {
      user_id: userId,
      date: new Date(order.created_at || new Date()).toISOString(),
      description: `Shopify Order #${order.order_number || order.id}`,
      amount: parseFloat(order.total_price),
      category: 'Sales',
      type: 'income' as 'income',
      created_at: new Date().toISOString()
    };

    transactionRepository.addTransaction(transaction);

    // Notify user
    notificationRepository.createNotification({
      user_id: userId,
      title: 'Shopify Order Received',
      message: `New sale: ${transaction.description} for $${transaction.amount}`,
      type: 'success'
    });

    console.log(`✅ Processed Shopify Webhook for User ${userId}`);
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Shopify Webhook Error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * POST /api/webhooks/woocommerce
 * Handle WooCommerce 'order.created' webhook
 */
router.post('/woocommerce', (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }

    const order = req.body;
    
    const transaction = {
      user_id: userId,
      date: new Date(order.date_created || new Date()).toISOString(),
      description: `WooCommerce Order #${order.id}`,
      amount: parseFloat(order.total),
      category: 'Sales',
      type: 'income' as 'income',
      created_at: new Date().toISOString()
    };

    transactionRepository.addTransaction(transaction);

    notificationRepository.createNotification({
      user_id: userId,
      title: 'WooCommerce Order Received',
      message: `New sale: ${transaction.description} for $${transaction.amount}`,
      type: 'success'
    });

    console.log(`✅ Processed WooCommerce Webhook for User ${userId}`);
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('WooCommerce Webhook Error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * POST /api/webhooks/custom
 * Handle generic JSON payload for custom integrations (Next.js, etc.)
 */
router.post('/custom', (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }

    const { amount, description, category, type, date } = req.body;

    if (!amount || !description) {
      return res.status(400).json({ error: 'Missing required fields: amount, description' });
    }

    const transaction = {
      user_id: userId,
      date: date || new Date().toISOString(),
      description: description,
      amount: parseFloat(amount),
      category: category || 'General',
      type: (type === 'expense' ? 'expense' : 'income') as 'income' | 'expense',
      created_at: new Date().toISOString()
    };

    transactionRepository.addTransaction(transaction);

    notificationRepository.createNotification({
      user_id: userId,
      title: 'External Transaction',
      message: `Received: ${transaction.description} - $${transaction.amount}`,
      type: 'info'
    });

    console.log(`✅ Processed Custom Webhook for User ${userId}`);
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Custom Webhook Error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
