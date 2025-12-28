import * as XLSX from 'xlsx';

export interface DocumentAnalysisResult {
  filename: string;
  rowCount: number;
  headers: string[];
  dataSample: any[];
  fullContent: string;
  summary: string;
}

export class DocumentService {
  /**
   * Parse an uploaded file buffer (Excel or CSV)
   */
  async parseDocument(buffer: Buffer, filename: string): Promise<DocumentAnalysisResult> {
    try {
      // Read the workbook
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      
      // Get the first sheet
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const data = XLSX.utils.sheet_to_json(sheet);
      
      if (data.length === 0) {
        throw new Error('Document is empty');
      }
      
      // Extract headers
      const headers = Object.keys(data[0] as object);
      
      // Create a text representation for the AI
      // Using CSV format for better token efficiency (50% less than JSON)
      const textContent = this.convertToCSV(data, headers);
      
      // Try to detect date range if there's a date column
      const dateRange = this.detectDateRange(data);
      
      return {
        filename,
        rowCount: data.length,
        headers,
        dataSample: data.slice(0, 5), // First 5 rows as sample
        fullContent: textContent,
        summary: `Document "${filename}" contains ${data.length} rows with columns: ${headers.join(', ')}.${dateRange ? ` Date range: ${dateRange}` : ''}`
      };
    } catch (error: any) {
      console.error('Error parsing document:', error);
      throw new Error(`Failed to parse document: ${error.message}`);
    }
  }
  
  /**
   * Convert JSON data to CSV text representation for the AI
   * CSV is much more token-efficient than JSON (~50% reduction)
   */
  private convertToCSV(data: any[], headers: string[]): string {
    // Increased limit to 5000 rows to support ~6 months of data
    const limit = 5000;
    const slicedData = data.slice(0, limit);
    
    // Create CSV header
    let csv = headers.join(',') + '\n';
    
    // Add rows
    for (const row of slicedData) {
      const values = headers.map(header => {
        const value = row[header];
        // Escape commas and quotes in values
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      csv += values.join(',') + '\n';
    }
    
    if (data.length > limit) {
      csv += `\n... and ${data.length - limit} more rows.`;
    }
    
    return csv;
  }
  
  /**
   * Attempt to detect date range from common date column names
   */
  private detectDateRange(data: any[]): string | null {
    const dateColumns = ['date', 'Date', 'DATE', 'transaction_date', 'created_at', 'timestamp'];
    
    for (const col of dateColumns) {
      if (data[0] && data[0][col]) {
        try {
          const firstDate = new Date(data[0][col]);
          const lastDate = new Date(data[data.length - 1][col]);
          
          if (!isNaN(firstDate.getTime()) && !isNaN(lastDate.getTime())) {
            return `${firstDate.toLocaleDateString()} to ${lastDate.toLocaleDateString()}`;
          }
        } catch (e) {
          // Not a valid date column, continue
        }
      }
    }
    
    return null;
  }
}

export default new DocumentService();
