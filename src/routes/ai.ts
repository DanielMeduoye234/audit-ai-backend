// API Route for AI Chat
import express from 'express';
import GeminiAccountantService from '../services/geminiAccountant';

const router = express.Router();
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn('⚠️  [AI ROUTE] GEMINI_API_KEY not found in environment variables!');
}

const aiService = new GeminiAccountantService(apiKey || '');

/**
 * GET /api/ai/debug
 * Test Gemini connectivity and list available models
 */
router.get('/debug', async (req, res) => {
  try {
    const results: any = {
      apiKeyLength: apiKey?.length || 0,
      env: process.env.NODE_ENV,
      availableModels: [],
      testStatus: 'Starting',
    };

    // Try native fetch list models to see if API is reachable
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      results.apiStatus = response.status;
      if (response.ok) {
        const data = await response.json() as any;
        results.availableModels = data.models?.map((m: any) => m.name) || [];
      } else {
        const errData = await response.text();
        results.apiError = errData;
      }
    } catch (fetchErr: any) {
      results.fetchError = fetchErr.message;
    }

    // Try a simple chat test
    try {
      const model = (aiService as any).genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = "Say 'Hello, I am working!'";
      const result = await model.generateContent(prompt);
      results.testResponse = result.response.text();
      results.testStatus = 'Success';
    } catch (chatErr: any) {
      results.chatError = chatErr.message;
      results.testStatus = 'Failed';
    }

    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate mock AI response for testing
 */
function generateMockResponse(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('cash') || lowerMessage.includes('balance')) {
    return "You've got $12,500 in the bank right now. That's actually up 10% from last month - nice work! You have 5 pending transactions totaling about $2,300, so your effective balance is around $10,200. Want me to show you a cash flow forecast for next month?";
  }
  
  if (lowerMessage.includes('revenue') || lowerMessage.includes('income')) {
    return "Your monthly revenue is currently $45,000, which is up 5% from last month. That's a great trend! The main drivers are invoice payments from your top clients. I can break down the revenue by client or category if you'd like.";
  }
  
  if (lowerMessage.includes('expense') || lowerMessage.includes('cost')) {
    return "Monthly expenses are at $32,500, down 8% from last month - excellent cost control! The biggest categories are payroll ($15,000), office rent ($5,000), and software subscriptions ($2,500). Want me to identify any optimization opportunities?";
  }
  
  if (lowerMessage.includes('profit') || lowerMessage.includes('margin')) {
    return "Your net profit is $12,500 with a 27.8% profit margin. That's solid for your industry! You're trending in the right direction. I can help you analyze ways to improve this further if you're interested.";
  }
  
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
    return "Hello! I'm your AI Accountant with real-time access to your financial data. I can see your cash balance is $12,500 and you have 5 pending transactions. What would you like to know about your finances?";
  }
  
  // Default response
  return `I understand you're asking about "${message}". Based on your current financial position (cash: $12,500, revenue: $45,000, expenses: $32,500), I can help you with detailed analysis. Could you be more specific about what aspect you'd like me to focus on?`;
}

/**
 * POST /api/ai/chat
 * Get AI response with conversation memory
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, userId } = req.body;

    if (!message || !userId) {
      return res.status(400).json({ error: 'Message and userId required' });
    }

    // Mock AI mode for testing without OpenAI credits
    if (process.env.USE_MOCK_AI === 'true') {
      const mockResponse = generateMockResponse(message);
      return res.json({
        response: mockResponse,
        timestamp: new Date(),
      });
    }

    // Get current financial context
    const basicContext = await getFinancialContext(userId);
    // [Power-Up] Fetch additional intelligence
    const runway = await financialIntelligence.getRunwayAnalysis(userId);
    const forecasts = await financialIntelligence.forecastCashFlow(userId, 1);
    const alertRepo = require('../repositories/alertRepository').default; // Lazy load to avoid circular dep issues if any
    const recentAnomalies = alertRepo.getAnomalies(userId, false).slice(0, 3); // Get top 3 unreviewed anomalies

    const financialContext = {
      ...basicContext,
      runway: { months: runway.runway_months, status: runway.status },
      forecast: forecasts.length > 0 ? { nextMonthBalance: forecasts[0].projected_balance, confidence: forecasts[0].confidence } : null,
      anomalies: recentAnomalies
    };

    // Get AI response
    const response = await aiService.chat(userId, message, financialContext);

    res.json({
      response,
      timestamp: new Date(),
    });
  } catch (error: any) {
    console.error('AI chat error:', error);
    const errorMessage = error?.error?.message || error.message || 'Failed to get AI response';
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * POST /api/ai/stream
 * Stream AI response word-by-word (like ChatGPT)
 */
router.post('/stream', async (req, res) => {
  try {
    const { message, userId } = req.body;

    if (!message || !userId) {
      return res.status(400).json({ error: 'Message and userId required' });
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Mock AI streaming mode for testing
    if (process.env.USE_MOCK_AI === 'true') {
      const mockResponse = generateMockResponse(message);
      const words = mockResponse.split(' ');
      
      for (let i = 0; i < words.length; i++) {
        const chunk = i === 0 ? words[i] : ' ' + words[i];
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate streaming delay
      }
      
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // Get current financial context
    const financialContext = await getFinancialContext(userId);

    // Stream AI response
    for await (const chunk of aiService.streamChat(userId, message, financialContext)) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('AI stream error:', error);
    const errorMessage = error?.error?.message || error.message || 'Failed to stream AI response';
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * DELETE /api/ai/history/:userId
 * Clear conversation history
 */
router.delete('/history/:userId', (req, res) => {
  const { userId } = req.params;
  aiService.clearHistory(userId);
  res.json({ message: 'History cleared' });
});

/**
 * GET /api/ai/history/:userId
 * Get conversation history
 */
router.get('/history/:userId', (req, res) => {
  const { userId } = req.params;
  const history = aiService.getHistory(userId);
  res.json({ history });
});

/**
 * GET /api/ai/conversations/:userId
 * Get all conversations grouped by date
 */
router.get('/conversations/:userId', (req, res) => {
  const { userId } = req.params;
  // We need to access the repository directly or add a method to the service
  // For simplicity, let's add a method to the service or import the repo here
  // Since we are in routes, let's import the repo
  const conversations = aiService.getAllConversations(userId);
  res.json({ conversations });
});

/**
 * Helper: Get current financial context for AI
 */
async function getFinancialContext(userId: string) {
  // Import the transaction repository
  const transactionRepository = require('../repositories/transactionRepository').default;
  
  // Get real financial summary from database
  const summary = transactionRepository.getFinancialSummary(userId);
  // Get more transaction history for better context (20 instead of 5)
  const recentTransactions = transactionRepository.getRecentTransactions(userId, 20);
  // Get monthly history for trend analysis (6 months)
  const monthlyHistory = transactionRepository.getMonthlyComparison(userId, 6);
  
  const profitMargin = summary.revenue > 0 ? ((summary.profit / summary.revenue) * 100).toFixed(1) : 0;
  
  return {
    cashBalance: summary.profit, // Using profit as cash balance for simplicity
    revenue: { current: summary.revenue, change: 5 }, // Mock change for now
    expenses: { current: summary.expenses, change: -8 }, // Mock change for now
    profit: summary.profit,
    profitMargin: parseFloat(profitMargin as string),
    transactions: recentTransactions.map((t: any) => ({
      date: t.date,
      description: t.description,
      amount: t.type === 'income' ? t.amount : -t.amount,
      category: t.category
    })),
    monthlyHistory: monthlyHistory.map((m: any) => ({
      month: m.month,
      income: m.income,
      expenses: m.expenses,
      profit: m.profit
    })),
    compliance: { score: 87, pendingItems: 3, upcomingDeadlines: 2 },
  };
}

/**
 * POST /api/ai/analyze-image
 * Analyze receipt/invoice image and extract transaction data
 */
router.post('/analyze-image', async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image data required' });
    }

    const extractedData = await aiService.analyzeImage(image);
    
    res.json({
      success: true,
      data: extractedData
    });
  } catch (error: any) {
    console.error('Image analysis error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to analyze image',
      success: false
    });
  }
});

export default router;
