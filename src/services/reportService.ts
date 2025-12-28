// Report Service - Handles CSV generation and report processing

import fs from 'fs';
import path from 'path';
import transactionRepository from '../repositories/transactionRepository';
import analyticsRepository from '../repositories/analyticsRepository';
import reportRepository, { Report } from '../repositories/reportRepository';

class ReportService {
  private reportsDir = path.join(__dirname, '../../reports');

  constructor() {
    // Ensure reports directory exists
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Generate a CSV report based on type
   */
  async generateReport(
    userId: string,
    type: 'financial' | 'transaction' | 'analytics' | 'compliance',
    dateRange: { startDate: string; endDate: string },
    filters?: any
  ): Promise<Report> {
    // Create report record
    const report = reportRepository.create({
      userId,
      type,
      dateRange,
      filters,
    });

    // Start async generation
    this.processReport(report.id).catch(error => {
      console.error(`Report generation failed for ${report.id}:`, error);
      reportRepository.markFailed(report.id, error.message);
    });

    return report;
  }

  /**
   * Process report generation asynchronously
   */
  private async processReport(reportId: string): Promise<void> {
    const report = reportRepository.findById(reportId);
    if (!report) throw new Error('Report not found');

    try {
      reportRepository.updateProgress(reportId, 10);

      // Generate CSV based on type
      let csvContent: string;
      switch (report.type) {
        case 'financial':
          csvContent = await this.generateFinancialReport(report);
          break;
        case 'transaction':
          csvContent = await this.generateTransactionReport(report);
          break;
        case 'analytics':
          csvContent = await this.generateAnalyticsReport(report);
          break;
        case 'compliance':
          csvContent = await this.generateComplianceReport(report);
          break;
        default:
          throw new Error(`Unknown report type: ${report.type}`);
      }

      reportRepository.updateProgress(reportId, 80);

      // Save CSV file
      const fileName = `${report.type}_${report.userId}_${Date.now()}.csv`;
      const filePath = path.join(this.reportsDir, fileName);
      fs.writeFileSync(filePath, csvContent, 'utf-8');

      reportRepository.updateProgress(reportId, 90);

      // Mark as completed
      reportRepository.markCompleted(reportId, fileName);
    } catch (error: any) {
      reportRepository.markFailed(reportId, error.message);
      throw error;
    }
  }

  /**
   * Generate Financial Summary Report
   */
  private async generateFinancialReport(report: Report): Promise<string> {
    const transactions = transactionRepository.getAllTransactions(report.userId);
    
    // Filter by date range
    const filtered = this.filterByDateRange(transactions, report.dateRange);

    reportRepository.updateProgress(report.id, 30);

    // Calculate financial metrics
    const revenue = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const profit = revenue - expenses;

    // Group by month
    const monthlyData = this.groupByMonth(filtered);

    reportRepository.updateProgress(report.id, 60);

    // Build CSV
    let csv = 'Financial Summary Report\n';
    csv += `Period: ${report.dateRange.startDate} to ${report.dateRange.endDate}\n`;
    csv += `Generated: ${new Date().toISOString()}\n\n`;
    csv += 'Overall Metrics\n';
    csv += 'Metric,Amount\n';
    csv += `Total Revenue,${revenue.toFixed(2)}\n`;
    csv += `Total Expenses,${expenses.toFixed(2)}\n`;
    csv += `Net Profit,${profit.toFixed(2)}\n`;
    csv += `Profit Margin,${revenue > 0 ? ((profit / revenue) * 100).toFixed(2) : 0}%\n\n`;
    
    csv += 'Monthly Breakdown\n';
    csv += 'Month,Revenue,Expenses,Profit\n';
    monthlyData.forEach(month => {
      csv += `${month.month},${month.revenue.toFixed(2)},${month.expenses.toFixed(2)},${month.profit.toFixed(2)}\n`;
    });

    return csv;
  }

  /**
   * Generate Transaction Log Report
   */
  private async generateTransactionReport(report: Report): Promise<string> {
    const transactions = transactionRepository.getAllTransactions(report.userId);
    
    // Filter by date range
    let filtered = this.filterByDateRange(transactions, report.dateRange);

    reportRepository.updateProgress(report.id, 40);

    // Apply additional filters
    if (report.filters?.type) {
      filtered = filtered.filter(t => t.type === report.filters.type);
    }
    if (report.filters?.category) {
      filtered = filtered.filter(t => t.category === report.filters.category);
    }

    reportRepository.updateProgress(report.id, 60);

    // Build CSV
    let csv = 'Transaction Log Report\n';
    csv += `Period: ${report.dateRange.startDate} to ${report.dateRange.endDate}\n`;
    csv += `Generated: ${new Date().toISOString()}\n\n`;
    csv += 'Date,Description,Type,Category,Amount,Status\n';
    
    filtered.forEach(t => {
      csv += `${t.date},"${t.description}",${t.type},${t.category},${t.amount.toFixed(2)},${t.status || 'completed'}\n`;
    });

    csv += `\nTotal Transactions: ${filtered.length}\n`;

    return csv;
  }

  /**
   * Generate Analytics Report
   */
  private async generateAnalyticsReport(report: Report): Promise<string> {
    const transactions = transactionRepository.getAllTransactions(report.userId);
    const filtered = this.filterByDateRange(transactions, report.dateRange);

    reportRepository.updateProgress(report.id, 40);

    // Calculate analytics
    const categoryBreakdown = this.calculateCategoryBreakdown(filtered);
    const monthlyTrends = this.groupByMonth(filtered);
    const avgTransaction = filtered.length > 0 
      ? filtered.reduce((sum, t) => sum + t.amount, 0) / filtered.length 
      : 0;

    reportRepository.updateProgress(report.id, 70);

    // Build CSV
    let csv = 'Analytics Report\n';
    csv += `Period: ${report.dateRange.startDate} to ${report.dateRange.endDate}\n`;
    csv += `Generated: ${new Date().toISOString()}\n\n`;
    
    csv += 'Key Metrics\n';
    csv += 'Metric,Value\n';
    csv += `Total Transactions,${filtered.length}\n`;
    csv += `Average Transaction,${avgTransaction.toFixed(2)}\n\n`;

    csv += 'Category Breakdown (Expenses)\n';
    csv += 'Category,Amount,Percentage\n';
    const totalExpenses = categoryBreakdown.reduce((sum, c) => sum + c.amount, 0);
    categoryBreakdown.forEach(cat => {
      const percentage = totalExpenses > 0 ? (cat.amount / totalExpenses * 100).toFixed(2) : 0;
      csv += `${cat.category},${cat.amount.toFixed(2)},${percentage}%\n`;
    });

    csv += '\nMonthly Trends\n';
    csv += 'Month,Revenue,Expenses,Profit,Transaction Count\n';
    monthlyTrends.forEach(month => {
      csv += `${month.month},${month.revenue.toFixed(2)},${month.expenses.toFixed(2)},${month.profit.toFixed(2)},${month.count}\n`;
    });

    return csv;
  }

  /**
   * Generate Compliance Report
   */
  private async generateComplianceReport(report: Report): Promise<string> {
    const transactions = transactionRepository.getAllTransactions(report.userId);
    const filtered = this.filterByDateRange(transactions, report.dateRange);

    reportRepository.updateProgress(report.id, 50);

    // Build CSV
    let csv = 'Compliance & Audit Report\n';
    csv += `Period: ${report.dateRange.startDate} to ${report.dateRange.endDate}\n`;
    csv += `Generated: ${new Date().toISOString()}\n`;
    csv += `Organization User ID: ${report.userId}\n\n`;
    
    csv += 'Audit Trail\n';
    csv += 'Transaction ID,Date,Type,Category,Amount,Description,Status\n';
    
    filtered.forEach(t => {
      csv += `${t.id},${t.date},${t.type},${t.category},${t.amount.toFixed(2)},"${t.description}",${t.status || 'completed'}\n`;
    });

    csv += '\nCompliance Summary\n';
    csv += `Total Transactions Audited: ${filtered.length}\n`;
    csv += `Date Range: ${report.dateRange.startDate} to ${report.dateRange.endDate}\n`;
    csv += `Report Generated: ${new Date().toISOString()}\n`;

    return csv;
  }

  /**
   * Get report file path
   */
  getReportFilePath(fileName: string): string {
    return path.join(this.reportsDir, fileName);
  }

  /**
   * Delete report file
   */
  deleteReportFile(fileName: string): void {
    const filePath = this.getReportFilePath(fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  // Helper methods

  private filterByDateRange(transactions: any[], dateRange: { startDate: string; endDate: string }): any[] {
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    
    return transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate >= start && tDate <= end;
    });
  }

  private groupByMonth(transactions: any[]): any[] {
    const monthMap: any = {};
    
    transactions.forEach(t => {
      const date = new Date(t.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthMap[monthKey]) {
        monthMap[monthKey] = {
          month: monthKey,
          revenue: 0,
          expenses: 0,
          profit: 0,
          count: 0,
        };
      }
      
      if (t.type === 'income') {
        monthMap[monthKey].revenue += t.amount;
      } else {
        monthMap[monthKey].expenses += t.amount;
      }
      monthMap[monthKey].profit = monthMap[monthKey].revenue - monthMap[monthKey].expenses;
      monthMap[monthKey].count++;
    });
    
    return Object.values(monthMap).sort((a: any, b: any) => a.month.localeCompare(b.month));
  }

  private calculateCategoryBreakdown(transactions: any[]): any[] {
    const categoryMap: any = {};
    
    transactions.filter(t => t.type === 'expense').forEach(t => {
      if (!categoryMap[t.category]) {
        categoryMap[t.category] = { category: t.category, amount: 0 };
      }
      categoryMap[t.category].amount += t.amount;
    });
    
    return Object.values(categoryMap).sort((a: any, b: any) => b.amount - a.amount);
  }
}

export default new ReportService();
