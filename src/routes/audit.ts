import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import auditService from '../services/auditService';

const router = Router();

/**
 * GET /api/audit/logs
 * Get audit logs with optional filters
 */
router.get('/logs', authenticate, async (req: Request, res: Response) => {
  try {
    const { user_id, action, entity_type, start_date, end_date, limit, offset } = req.query;

    const filters: any = {};
    
    // Only allow users to see their own logs (unless admin - future enhancement)
    filters.user_id = (req as any).user.id;

    if (action) filters.action = action as string;
    if (entity_type) filters.entity_type = entity_type as string;
    if (start_date) filters.start_date = start_date as string;
    if (end_date) filters.end_date = end_date as string;
    if (limit) filters.limit = parseInt(limit as string);
    if (offset) filters.offset = parseInt(offset as string);

    const logs = auditService.getAuditLogs(filters);
    const total = auditService.getAuditLogsCount(filters);

    res.json({
      success: true,
      data: {
        logs,
        total,
        limit: filters.limit || null,
        offset: filters.offset || 0
      }
    });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs',
      message: error.message
    });
  }
});

/**
 * GET /api/audit/logs/:id
 * Get a specific audit log by ID
 */
router.get('/logs/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const log = auditService.getAuditLogById(parseInt(id));

    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'Audit log not found'
      });
    }

    // Ensure user can only access their own logs
    if (log.user_id !== (req as any).user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: log
    });
  } catch (error: any) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit log',
      message: error.message
    });
  }
});

/**
 * GET /api/audit/stats
 * Get audit statistics for the user
 */
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    // Get counts by action type
    const actions = ['create', 'update', 'delete', 'login', 'logout', 'upload', 'ai_chat'];
    const stats: any = {};

    for (const action of actions) {
      stats[action] = auditService.getAuditLogsCount({ user_id: userId, action });
    }

    // Get total count
    stats.total = auditService.getAuditLogsCount({ user_id: userId });

    // Get recent activity (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    stats.last_24h = auditService.getAuditLogsCount({
      user_id: userId,
      start_date: yesterday.toISOString()
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('Error fetching audit stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit statistics',
      message: error.message
    });
  }
});

export default router;
