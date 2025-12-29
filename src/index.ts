// Backend Server Entry Point - Auto Import with Notifications

import dotenv from 'dotenv';
dotenv.config(); // Load env vars before other imports

import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import aiRoutes from './routes/ai';
import notificationRoutes from './routes/notifications';
import transactionRoutes from './routes/transactions';
import userRoutes from './routes/users';
import searchRoutes from './routes/search';
import analyticsRoutes from './routes/analytics';
import budgetRoutes from './routes/budgets';
import alertRoutes from './routes/alerts';
import auditRoutes from './routes/audit';

import documentRoutes from './routes/documents';
import reportRoutes from './routes/reports';
import webhookRoutes from './routes/webhooks';
import feedbackRoutes from './routes/feedback';


const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: true, // Allow all origins (reflects request origin)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Log requests (simplified for production)
app.use((req, res, next) => {
  if (!req.url.includes('/api/notifications')) { // Skip noisy notification polling
    console.log(`${req.method} ${req.url}`);
  }
  next();
});
app.use(express.json());

// Routes
// Routes
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/feedback', feedbackRoutes);


// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'AUDIT AI Backend is running' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 AUDIT AI Backend running on port ${PORT}`);
  console.log(`📊 AI Accountant ready to serve`);
});
