import express from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import documentService from '../services/documentService';
import transactionRepository from '../repositories/transactionRepository';
import notificationRepository from '../repositories/notificationRepository';
import { authenticate } from '../middleware/auth';
import auditService from '../services/auditService';
import geminiAccountant from '../services/geminiAccountant'; // Import Gemini

const router = express.Router();

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || // xlsx
      file.mimetype === 'application/vnd.ms-excel' || // xls
      file.mimetype === 'text/csv' || // csv
      file.mimetype === 'application/pdf' || // pdf
      file.originalname.match(/\.(xlsx|xls|csv|pdf)$/) // fallback extension check
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel, CSV, and PDF files are allowed'));
    }
  }
});

/**
 * POST /api/documents/analyze
 * Upload and parse a document
 */
router.post('/analyze', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`📄 [Documents] Analyzing file: ${req.file.originalname}`);
    
    const result = await documentService.parseDocument(req.file.buffer, req.file.originalname);
    
    console.log(`✅ [Documents] Successfully parsed ${result.rowCount} rows`);
    
    // Log audit trail
    const user = (req as any).user;
    if (user && user.id) {
      auditService.logDocumentUpload(
        user.id,
        req.file.originalname,
        { rowCount: result.rowCount, headers: result.headers },
        user.email
      );
    }

    // RUN AI AUDIT (The "Powerful" Part)
    let aiAuditResult = null;
    try {
        console.log('🧠 [Documents] Running Gemini AI Audit on file content...');
        const gemini = new geminiAccountant(process.env.GEMINI_API_KEY || '');
        aiAuditResult = await gemini.auditFinancialRecords(result.fullContent);
        console.log('✅ [Documents] AI Audit completed successfully.');
    } catch (aiError) {
        console.error('⚠️ [Documents] AI Audit failed (non-blocking):', aiError);
    }

    // AUTO-IMPORT TRANSACTIONS (Best Effort)
    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    try {
      // Parse the CSV data back to JSON for processing
      const rows = result.dataSample; // Use full data if available
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const allData = XLSX.utils.sheet_to_json(sheet);

      for (const row of allData as any[]) {
        try {
          // Intelligent column mapping
          const transaction = {
            user_id: user.id,
            date: extractDate(row),
            description: extractDescription(row),
            amount: extractAmount(row),
            category: extractCategory(row),
            type: extractType(row)
          };

          // Validate required fields
          if (!transaction.date || !transaction.amount || !transaction.type) {
            skippedCount++;
            continue;
          }

          // Import transaction
          transactionRepository.addTransaction(transaction);
          importedCount++;
        } catch (err: any) {
          skippedCount++;
          errors.push(`Row error: ${err.message}`);
        }
      }

      console.log(`✅ [Documents] Imported ${importedCount} transactions, skipped ${skippedCount}`);
      
      // Create notification for successful import
      if (importedCount > 0) {
        notificationRepository.createNotification({
          user_id: user.id,
          title: 'Transactions Imported',
          message: `Successfully imported ${importedCount} transactions from ${req.file.originalname}`,
          type: 'success'
        });
      }
    } catch (importError: any) {
      console.error('❌ [Documents] Import error:', importError);
      // Continue even if import fails - still return the analysis
    }
    
    res.json({
      success: true,
      data: {
        ...result,
        imported: importedCount,
        skipped: skippedCount,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined, // Return first 5 errors
        aiAudit: aiAuditResult // Return the AI analysis
      }
    });
  } catch (error: any) {
    console.error('❌ [Documents] Analysis error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to analyze document',
      success: false
    });
  }
});

// Helper functions for intelligent column mapping
function extractDate(row: any): string {
  const dateFields = ['date', 'Date', 'DATE', 'transaction_date', 'Transaction Date', 'created_at', 'timestamp'];
  for (const field of dateFields) {
    if (row[field]) {
      try {
        const date = new Date(row[field]);
        return date.toISOString().split('T')[0];
      } catch {
        continue;
      }
    }
  }
  return new Date().toISOString().split('T')[0]; // Default to today
}

function extractDescription(row: any): string {
  const descFields = ['description', 'Description', 'DESCRIPTION', 'memo', 'Memo', 'note', 'Note', 'details', 'Details'];
  for (const field of descFields) {
    if (row[field]) return String(row[field]);
  }
  return 'Imported transaction';
}

function extractAmount(row: any): number {
  const amountFields = ['amount', 'Amount', 'AMOUNT', 'value', 'Value', 'total', 'Total', 'price', 'Price'];
  for (const field of amountFields) {
    if (row[field] !== undefined && row[field] !== null) {
      const value = String(row[field]).replace(/[^0-9.-]/g, ''); // Remove currency symbols
      const num = parseFloat(value);
      if (!isNaN(num)) return Math.abs(num); // Always positive
    }
  }
  return 0;
}

function extractCategory(row: any): string {
  const catFields = ['category', 'Category', 'CATEGORY', 'type', 'Type', 'class', 'Class'];
  for (const field of catFields) {
    if (row[field]) return String(row[field]);
  }
  return 'Other';
}

function extractType(row: any): 'income' | 'expense' {
  // Check explicit type column
  const typeFields = ['type', 'Type', 'TYPE', 'transaction_type', 'Transaction Type'];
  for (const field of typeFields) {
    if (row[field]) {
      const value = String(row[field]).toLowerCase();
      if (value.includes('income') || value.includes('revenue') || value.includes('credit')) return 'income';
      if (value.includes('expense') || value.includes('debit') || value.includes('payment')) return 'expense';
    }
  }

  // Infer from amount sign
  const amountFields = ['amount', 'Amount', 'AMOUNT', 'value', 'Value'];
  for (const field of amountFields) {
    if (row[field] !== undefined) {
      const value = String(row[field]);
      if (value.includes('-')) return 'expense';
      if (value.includes('+')) return 'income';
    }
  }

  // Default to expense
  return 'expense';
}

export default router;
