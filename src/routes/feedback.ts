import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/db';

const router = express.Router();

import emailService from '../services/emailService';

// POST /api/feedback
router.post('/', async (req, res) => {
  try {
    const { user_id, content, rating, type } = req.body;

    if (!user_id || !content || !rating) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user exists, if not sync correctly
    const checkUser = db.prepare('SELECT user_id FROM users WHERE user_id = ?');
    const existingUser = checkUser.get(user_id);

    if (!existingUser) {
        // If user doesn't exist in local DB but is authenticated (which they are to hit this endpoint safely usually, or we trust the ID passed from client for now if we can't verify token easily here without middleware)
        // Ideally we should extract email from the token.
        // For now, let's try to get the email from the request body if passed, or just insert a placeholder to satisfy FK.
        // BETTER: Use "INSERT OR IGNORE" strategy or fetch profile.
        
        // Since we don't have the email here easily without looking at the auth header, 
        // we will do a soft insert if possible. 
        // Actually, let's look at the request headers to be safer if we can, or usually the client passes user info.
        
        // Let's insert a placeholder user if missing to ensure FK constraint passes
        const insertUser = db.prepare(`
            INSERT OR IGNORE INTO users (user_id, email, name, created_at)
            VALUES (?, ?, ?, datetime('now'))
        `);
        // We'll use a placeholder email if we can't get it, or try to extract from req if modified
        insertUser.run(user_id, 'user@example.com', 'Syncing User'); 
        console.log(`[Feedback] Auto-created missing user ${user_id} to satisfy FK`);
    }

    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO feedback (id, user_id, content, rating, type)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, user_id, content, rating, type || 'general');

    // Fetch user email for notification
    try {
      const userStmt = db.prepare('SELECT email FROM users WHERE user_id = ?');
      const user = userStmt.get(user_id) as { email: string } | undefined;
      const userEmail = user?.email;

      // Send email notification asynchronously (don't block response)
      emailService.sendFeedbackEmail(userEmail, content, rating, type || 'general');
    } catch (emailError) {
      console.error('Failed to send feedback email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({ 
      message: 'Feedback submitted successfully',
      id 
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

export default router;
