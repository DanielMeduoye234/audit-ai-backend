// Report Routes - API endpoints for report generation and management

import express from 'express';
import reportService from '../services/reportService';
import reportRepository from '../repositories/reportRepository';
import { authenticate } from '../middleware/auth';
import fs from 'fs';

const router = express.Router();

/**
 * POST /api/reports/generate
 * Generate a new report
 */
router.post('/generate', authenticate, async (req, res) => {
  try {
    const { type, dateRange, filters } = req.body;
    const userId = req.user!.id;

    // Validate input
    if (!type || !dateRange || !dateRange.startDate || !dateRange.endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: type, dateRange.startDate, dateRange.endDate',
      });
    }

    // Validate report type
    const validTypes = ['financial', 'transaction', 'analytics', 'compliance'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid report type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    // Generate report
    const report = await reportService.generateReport(userId, type, dateRange, filters);

    res.json({
      success: true,
      report,
    });
  } catch (error: any) {
    console.error('Report generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate report',
    });
  }
});

/**
 * GET /api/reports/:userId
 * Get all reports for a user
 */
router.get('/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user!.id;

    // Ensure user can only access their own reports
    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot access other users\' reports',
      });
    }

    const reports = reportRepository.findByUserId(userId);

    res.json({
      success: true,
      reports,
    });
  } catch (error: any) {
    console.error('Get reports error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve reports',
    });
  }
});

/**
 * GET /api/reports/:reportId/status
 * Get report generation status
 */
router.get('/:reportId/status', authenticate, async (req, res) => {
  try {
    const { reportId } = req.params;
    const userId = req.user!.id;

    const report = reportRepository.findById(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    // Ensure user owns this report
    if (report.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot access other users\' reports',
      });
    }

    res.json({
      success: true,
      status: report.status,
      progress: report.progress,
      error: report.error,
    });
  } catch (error: any) {
    console.error('Get report status error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get report status',
    });
  }
});

/**
 * GET /api/reports/:reportId/download
 * Download report CSV file
 */
router.get('/:reportId/download', authenticate, async (req, res) => {
  try {
    const { reportId } = req.params;
    const userId = req.user!.id;

    const report = reportRepository.findById(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    // Ensure user owns this report
    if (report.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot access other users\' reports',
      });
    }

    // Check if report is completed
    if (report.status !== 'completed' || !report.fileName) {
      return res.status(400).json({
        success: false,
        error: 'Report is not ready for download',
      });
    }

    // Get file path
    const filePath = reportService.getReportFilePath(report.fileName);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Report file not found',
      });
    }

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${report.fileName}"`);

    // Stream file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error: any) {
    console.error('Download report error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to download report',
    });
  }
});

/**
 * DELETE /api/reports/:reportId
 * Delete a report
 */
router.delete('/:reportId', authenticate, async (req, res) => {
  try {
    const { reportId } = req.params;
    const userId = req.user!.id;

    const report = reportRepository.findById(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    // Ensure user owns this report
    if (report.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot delete other users\' reports',
      });
    }

    // Delete file if exists
    if (report.fileName) {
      try {
        reportService.deleteReportFile(report.fileName);
      } catch (error) {
        console.error('Failed to delete report file:', error);
        // Continue with deletion even if file deletion fails
      }
    }

    // Delete report record
    reportRepository.delete(reportId);

    res.json({
      success: true,
      message: 'Report deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete report error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete report',
    });
  }
});

export default router;
