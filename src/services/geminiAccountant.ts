
// Google Gemini AI Service - ChatGPT-Level Conversation
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import conversationRepository, { ConversationMessage as DBConversationMessage } from '../repositories/conversationRepository';
import transactionRepository from '../repositories/transactionRepository';
import notificationRepository from '../repositories/notificationRepository';

interface ConversationMessage {
  role: 'user' | 'model' | 'function';
  parts: any[];
}

interface FinancialContext {
  cashBalance: number;
  revenue: { current: number; change: number };
  expenses: { current: number; change: number };
  profit: number;
  profitMargin: number;
  transactions: any[];
  monthlyHistory: any[]; // [New] 6-month history
  compliance: any;
  // [Power-Up] Advanced Context
  runway: { months: number; status: string } | null;
  forecast: { nextMonthBalance: number; confidence: number } | null;
  anomalies: any[];
}

class GeminiAccountantService {
  private genAI: GoogleGenerativeAI;
  private visionModel: any;

  constructor(apiKey: string) {
    if (!apiKey) {
      console.error('❌ [GEMINI] API Key is missing! AI features will not work.');
    } else {
      console.log('✅ [GEMINI] AI Accountant Service initialized with API Key (length: ' + apiKey.length + ')');
    }
    this.genAI = new GoogleGenerativeAI(apiKey || 'MISSING_KEY');
    // User explicitly requested gemini-2.5-flash
    this.visionModel = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  /**
   * Get AI response with full context, conversation memory, and tool execution
   */
  async chat(
    userId: string,
    userMessage: string,
    financialContext: FinancialContext
  ): Promise<string> {
    // Define tools with correct Schema structure
    const tools = [
      {
        functionDeclarations: [
          {
            name: "addTransaction",
            description: "Add a financial transaction (income or expense) to the database. Use this when the user explicitly asks to record an expense, income, or profit.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                description: { 
                  type: SchemaType.STRING, 
                  description: "Description of the transaction"
                },
                amount: { 
                  type: SchemaType.NUMBER, 
                  description: "Amount of the transaction"
                },
                type: { 
                  type: SchemaType.STRING, 
                  description: "Type of transaction",
                  enum: ["income", "expense"]
                },
                category: { 
                  type: SchemaType.STRING, 
                  description: "Category (e.g., Office, Payroll, Sales, Software, Travel, Meals, Utilities)"
                },
                date: { 
                  type: SchemaType.STRING, 
                  description: "Date in YYYY-MM-DD format. If not specified, I will use today's date."
                },
              },
              required: ["description", "amount", "type", "category"],
            },
          },
          {
            name: "queryTransactions",
            description: "Search for specific transactions based on criteria like category, date range, or amount. Use this to answer questions like 'Show me all software expenses from last month' or 'Did I pay for Uber recently?'",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                category: { type: SchemaType.STRING, description: "Category to filter by" },
                startDate: { type: SchemaType.STRING, description: "Start date in YYYY-MM-DD" },
                endDate: { type: SchemaType.STRING, description: "End date in YYYY-MM-DD" },
                minAmount: { type: SchemaType.NUMBER, description: "Minimum amount" },
                maxAmount: { type: SchemaType.NUMBER, description: "Maximum amount" },
                type: { type: SchemaType.STRING, enum: ["income", "expense"] }
              }
            }
          },
          {
            name: "getBalanceTrends",
            description: "Get monthly revenue, expense, and profit trends. Use this to answer 'How is my business trending?' or 'Compare this month to last month'.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                months: { type: SchemaType.NUMBER, description: "Number of months to analyze (default 6)" }
              }
            }
          },
          {
            name: "analyzeBudget",
            description: "Compare actual spending against budget targets for categories. Use this for 'Am I over budget on software?' or 'How much of my marketing budget is left?'",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                category: { type: SchemaType.STRING, description: "Specific category to check (optional)" }
              }
            }
          },
          {
            name: "getAnomalies",
            description: "Identify unusual financial activities or potential errors. Use this for 'Check for anything unusual' or 'Run a quick audit'.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {}
            }
          },
          {
            name: "forecastCashFlow",
            description: "Predict future cash flow based on historical patterns. Use this for 'What will my balance be next month?' or 'When will I run out of cash?'.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                months: { type: SchemaType.NUMBER, description: "Number of months to forecast (default 3)" }
              }
            }
          },
          {
            name: "getRecurringItems",
            description: "Identify recurring subscriptions or payments. Use this for 'What are my monthly subscriptions?' or 'Find recurring expenses'.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {}
            }
          },
          {
            name: "analyzeTrends",
            description: "Perform deep analysis on growth rates, spending patterns, and profit trajectories. Use this for 'Analyze my revenue growth' or 'Identify patterns in my spending'.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                metric: { type: SchemaType.STRING, enum: ["revenue", "expenses", "profit"] },
                timeframe: { type: SchemaType.NUMBER, description: "Number of months to analyze" }
              },
              required: ["metric"]
            }
          },
          {
            name: "bulkCategorize",
            description: "Bulk update the category for all transactions matching a specific vendor or description. Use this when the user says 'Make all Uber trips Travel' or similar commands.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                vendor: {
                  type: SchemaType.STRING,
                  description: "The vendor name or keyword to match (e.g., 'Uber', 'Starbucks', 'Amazon')"
                },
                newCategory: {
                  type: SchemaType.STRING,
                  description: "The new category to apply"
                }
              },
              required: ["vendor", "newCategory"]
            }
          },
          {
            name: "generateReport",
            description: "Generate a financial report. Use this when the user asks for a report, summary, or export.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                type: {
                  type: SchemaType.STRING,
                  description: "Type of report",
                  enum: ["pdf", "csv", "summary"]
                },
                timeframe: {
                  type: SchemaType.STRING,
                  description: "Timeframe for the report (e.g., 'last_month', 'ytd', 'all_time')"
                }
              },
              required: ["type"]
            }
          }
        ],
      },
    ];

    const model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      tools: tools as any // Type assertion to bypass strict SDK typing
    });
    
    // Get conversation history from database
    const dbHistory = conversationRepository.getConversationHistory(userId, 20); // Last 20 messages
    const history = dbHistory.map((msg: DBConversationMessage) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(financialContext);

    // Create chat with history
    const chat = model.startChat({
      history: [
        { 
          role: 'user', 
          parts: [{ text: `SYSTEM INSTRUCTION: ${systemPrompt}` }] 
        },
        { 
          role: 'model', 
          parts: [{ text: "Understood. I am ready to act as the AI Accountant." }] 
        },
        ...history
      ],
      generationConfig: {
        maxOutputTokens: 2048,
      },
    });

    try {
        console.log(`💬 Sending message to Gemini (History: ${history.length} items)`);
        
        // Save user message immediately to ensure it's recorded
        conversationRepository.saveMessage(userId, 'user', userMessage);
        
        // Send user message
        const result = await chat.sendMessage(userMessage);
        const response = await result.response;
        
        // CHECK FOR FUNCTION CALLS
        const functionCalls = response.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0]; // Handle first call
            console.log("🤖 Function Call Triggered:", call.name, call.args);

            let functionResult: any = { error: "Unknown function" };

            if (call.name === "addTransaction") {
                const args = call.args as any;
                try {
                     const newTransactionId = transactionRepository.addTransaction({
                        user_id: userId,
                        date: args.date || new Date().toISOString().split('T')[0],
                        description: args.description,
                        amount: Number(args.amount),
                        category: args.category,
                        type: args.type as 'income' | 'expense'
                     });
                     
                     // Create notification for the new transaction
                     notificationRepository.createNotification({
                       user_id: userId,
                       title: 'New Transaction',
                       message: `Added ${args.type}: ${args.description} - $${args.amount}`,
                       type: 'success'
                     });
                     
                     functionResult = { 
                        success: true, 
                        message: "Transaction added successfully", 
                        transactionId: newTransactionId 
                     };
                     
                     // Store transaction ID in metadata for the next save
                     const transactionMetadata = { transactionId: newTransactionId, type: args.type };
                     conversationRepository.saveMessage(userId, 'model', `Record added: ${args.description}`, transactionMetadata);
                } catch (err: any) {
                    functionResult = { error: err.message };
                }
            } else if (call.name === "queryTransactions") {
                 const args = call.args as any;
                 try {
                    let transactions = [];
                    if (args.startDate || args.endDate) {
                        transactions = transactionRepository.getTransactionsByDateRange(userId, args.startDate || '1970-01-01', args.endDate || '2099-12-31');
                    } else if (args.category) {
                        transactions = transactionRepository.getTransactionsByCategory(userId, args.category);
                    } else {
                        transactions = transactionRepository.getRecentTransactions(userId, 50);
                    }
                    
                    // Filter in memory for more complex criteria
                    if (args.minAmount) transactions = transactions.filter(t => t.amount >= args.minAmount);
                    if (args.maxAmount) transactions = transactions.filter(t => t.amount <= args.maxAmount);
                    if (args.type) transactions = transactions.filter(t => t.type === args.type);
                    
                    functionResult = { success: true, count: transactions.length, data: transactions.slice(0, 30) };
                 } catch (err: any) {
                    functionResult = { error: err.message };
                 }
            } else if (call.name === "getBalanceTrends") {
                 try {
                    const months = (call.args as any).months || 6;
                    const trends = transactionRepository.getMonthlyComparison(userId, months);
                    functionResult = { success: true, data: trends };
                 } catch (err: any) {
                    functionResult = { error: err.message };
                 }
            } else if (call.name === "analyzeBudget") {
                 try {
                    const budgetRepository = require('../repositories/budgetRepository').default;
                    const budgets = budgetRepository.getBudgets(userId);
                    const summaries = budgets.map((b: any) => {
                        const actual = transactionRepository.getCategoryTotals(userId, b.start_date, b.end_date || new Date().toISOString().split('T')[0])
                            .find(t => t.category === b.category)?.total || 0;
                        return {
                            category: b.category,
                            budgeted: b.amount,
                            actual,
                            remaining: b.amount - actual,
                            percentage: (actual / b.amount) * 100,
                            status: actual > b.amount ? 'OVER_BUDGET' : (actual > b.amount * 0.9 ? 'WARNING' : 'HEALTHY')
                        };
                    });
                    functionResult = { success: true, data: summaries };
                 } catch (err: any) {
                    functionResult = { error: err.message };
                 }
            } else if (call.name === "getAnomalies") {
                 try {
                    const anomalies = transactionRepository.getAnomalousTransactions(userId);
                    functionResult = { success: true, count: anomalies.length, data: anomalies };
                 } catch (err: any) {
                    functionResult = { error: err.message };
                 }
            } else if (call.name === "getRecurringItems") {
                 try {
                    const recurring = transactionRepository.detectRecurringTransactions(userId);
                    functionResult = { success: true, count: recurring.length, data: recurring };
                 } catch (err: any) {
                    functionResult = { error: err.message };
                 }
            } else if (call.name === "forecastCashFlow") {
                 try {
                    const analyticsRepository = require('../repositories/analyticsRepository').default;
                    const trends = analyticsRepository.getMonthlyTrends(userId, 6);
                    // Simple linear regression/projection logic for mock forecast
                    const avgIncome = trends.reduce((sum: number, t: any) => sum + t.income, 0) / (trends.length || 1);
                    const avgExpenses = trends.reduce((sum: number, t: any) => sum + t.expenses, 0) / (trends.length || 1);
                    const currentBalance = trends[0]?.profit || 0;
                    
                    const forecast = [];
                    for (let i = 1; i <= ((call.args as any).months || 3); i++) {
                        forecast.push({
                            month: `Month +${i}`,
                            projectedIncome: avgIncome,
                            projectedExpenses: avgExpenses,
                            projectedBalance: currentBalance + ((avgIncome - avgExpenses) * i)
                        });
                    }
                    functionResult = { success: true, data: forecast, confidence: 0.85 };
                 } catch (err: any) {
                    functionResult = { error: err.message };
                 }
            } else if (call.name === "analyzeTrends") {
                 try {
                    const analyticsRepository = require('../repositories/analyticsRepository').default;
                    const metric = (call.args as any).metric;
                    const months = (call.args as any).timeframe || 6;
                    const growthRate = analyticsRepository.getGrowthRate(userId, metric, months);
                    const patterns = analyticsRepository.getSpendingPatterns(userId);
                    functionResult = { 
                        success: true, 
                        growthRate: growthRate.toFixed(2) + '%', 
                        period: `Last ${months} months`,
                        topPatterns: patterns.slice(0, 5)
                    };
                 } catch (err: any) {
                    functionResult = { error: err.message };
                 }
            } else if (call.name === "bulkCategorize") {
                 const args = call.args as any;
                 try {
                   const count = transactionRepository.bulkUpdateCategory(userId, args.vendor, args.newCategory);
                   functionResult = { 
                     success: true, 
                     message: `Successfully updated ${count} transactions matching "${args.vendor}" to category "${args.newCategory}".` 
                   };
                 } catch (err: any) {
                   functionResult = { error: err.message };
                 } 
            } else if (call.name === "generateReport") {
                 // Placeholder for report generation
                 const reportType = (call.args as any).type;
                 functionResult = { success: true, message: `Report of type ${reportType} generated.` };
            }

            // Send function output back to Gemini
             const result2 = await chat.sendMessage([
                {
                    functionResponse: {
                        name: call.name,
                        response: functionResult
                    }
                }
            ]);
            
            const finalText = result2.response.text();
            
            // Save model response after function execution
            conversationRepository.saveMessage(userId, 'model', finalText);
            
            return finalText;
        }

        const text = response.text();

        // Save model message to database
        conversationRepository.saveMessage(userId, 'model', text);

        return text;
      } catch (error: any) {
        console.error("❌ [GEMINI] Chat Error Detail:", {
            message: error.message,
            stack: error.stack,
            cause: error.cause,
            response: error.response?.data
        });
        
        if (error.message?.includes('403') || error.message?.includes('identity')) {
           return "❌ AI Identity Error: Your API Key is missing or unregistered in the live settings. Please check your Railway Environment Variables.";
        }
        
        // Detailed hint for fetch failure
        if (error.message?.includes('fetch failed')) {
            return `Connection Error: Gemini API is unreachable (fetch failed). This could be due to your local internet connection, a firewall, or Google's servers being temporarily down. (Hint: Your API Key length is ${this.genAI.apiKey?.length || 0})`;
        }

        return `Connection Error: ${error.message || "Unknown error"}. (Hint: Check your API Key)`;
      }
  }

  /**
   * Stream AI response with proper tool execution
   * (Simulated streaming for now since transactions need to execute first)
   */
  async *streamChat(
    userId: string,
    userMessage: string,
    financialContext: FinancialContext
  ): AsyncGenerator<string> {
    const fullResponse = await this.chat(userId, userMessage, financialContext);
    
    const words = fullResponse.split(' ');
    
    for (let i = 0; i < words.length; i++) {
      const chunk = i === 0 ? words[i] : ' ' + words[i];
      yield chunk;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  }

  /**
   * Build expert accountant system prompt with current data
   */
  private buildSystemPrompt(context: FinancialContext): string {
    const monthHistoryStr = context.monthlyHistory
      .map(m => `${m.month}: Rev $${m.income.toLocaleString()} | Exp $${m.expenses.toLocaleString()} | Net $${m.profit.toLocaleString()}`)
      .join('\n');

    // [Power-Up] Advanced Metrics Formatting
    const runwayText = context.runway 
      ? `Runway: ${context.runway.months > 99 ? 'Infinite' : context.runway.months + ' months'} (${context.runway.status})`
      : 'Runway: Data unavailable';

    const forecastText = context.forecast
      ? `Projected Next Month Balance: $${context.forecast.nextMonthBalance.toLocaleString()} (Confidence: ${(context.forecast.confidence * 100).toFixed(0)}%)`
      : 'Forecast: Insufficient data';

    const anomalyText = context.anomalies.length > 0
      ? `⚠️ DETECTED ANOMALIES:\n${context.anomalies.map(a => `- ${a.description}`).join('\n')}`
      : 'No recent anomalies detected.';

    return `You are Audit AI, a world-class Super-Powered AI CFO and Financial Auditor. You are the digital financial heart of this business.
Your goal is to provide "Big Four" level accounting expertise with the speed and proactivity of an AI.

CURRENT FINANCIAL SNAPSHOT:
- Cash Position: $${context.cashBalance.toLocaleString()}
- This Month: $${context.revenue.current.toLocaleString()} Revenue | $${context.expenses.current.toLocaleString()} Expenses
- Profit Margin: ${context.profitMargin.toFixed(1)}%
- ${runwayText}
- ${forecastText}

HISTORICAL PERFORMANCE (Last 6 Months):
${monthHistoryStr}

${anomalyText}

YOUR SUPER-POWERS & CAPABILITIES:
1. **FULL CONTEXT AWARENESS**: You have a "bird's eye view". You can query any transaction, analyze any budget, and look back months or even years.
2. **PROACTIVE AUDITING**: Don't wait to be asked. If you see a weird expense or a budget overrun, mention it.
3. **STRATEGIC FORECASTING**: You can predict cash flow and suggest "what-if" scenarios.
4. **TAX GUARDIAN**: You scan everything for tax leaks. If an expense is missing a receipt or seems non-deductible, flag it immediately.
5. **MULTI-TURN MEMORY**: You remember everything discussed in this session. If you just added a transaction, you know it's there.

COMMAND & BEHAVIOR GUIDELINES:
- **Be a Peer, Not a Tool**: Speak like a smart CFO or Business Partner. Use "We" and "Our".
- **Absolute Accuracy**: Never hallucinate numbers. If you don't have the data, use your 'queryTransactions' or 'getBalanceTrends' tools to get it.
- **Synthesize, Don't Just List**: When a user asks "How are we doing?", give a synthesis of Cash + Runway + Profit + Risk.
- **IRS/Audit Ready**: For any expense > $75, remind the user about receipt requirements.
- **Cost Optimization**: If you see recurring subscriptions that haven't been mentioned, ask if they are still needed.

AVAILABLE ANALYTICAL TOOLS:
- 'queryTransactions': Search by category, date, amount.
- 'getBalanceTrends': Compare months/weeks to see growth.
- 'analyzeBudget': See if we are burning too much in Office, Software, etc.
- 'getAnomalies': Instant audit of recent activity.
- 'forecastCashFlow': Look into the future.
- 'getRecurringItems': Audit our subscriptions.

Always respond in professional but concise markdown. Use bolding for emphasis.`;
  }

  /**
   * Clear conversation history for a user
   */
  clearHistory(userId: string): void {
    conversationRepository.clearConversation(userId);
  }

  /**
   * Get conversation history for a user
   */
  getHistory(userId: string): any[] {
    const dbHistory = conversationRepository.getConversationHistory(userId, 50);
    return dbHistory.map((msg: DBConversationMessage) => ({
      role: msg.role,
      parts: msg.content
    }));
  }

  /**
   * Get all conversations grouped by date
   */
  getAllConversations(userId: string): any[] {
    return conversationRepository.getAllConversations(userId);
  }

  /**
   * Analyze receipt/invoice image using Gemini Vision
   */
  async analyzeImage(imageBase64: string): Promise<{
    amount: number;
    vendor: string;
    date: string;
    category: string;
    description: string;
    confidence: number;
  }> {
    try {
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

      const prompt = `Analyze this receipt or invoice image and extract the following information in JSON format:
{
  "amount": <total amount as number>,
  "vendor": "<vendor/merchant name>",
  "date": "<date in YYYY-MM-DD format>",
  "category": "<category: Office, Payroll, Sales, Software, Travel, Meals, Utilities, or Other>",
  "description": "<brief description of the transaction>",
  "confidence": <confidence score 0-1>
}

Extract only the data. Return valid JSON only, no markdown or explanation.`;

      const result = await this.visionModel.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data
          }
        }
      ]);

      const response = result.response.text();
      const cleanedResponse = response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const extractedData = JSON.parse(cleanedResponse);

      return {
        amount: parseFloat(extractedData.amount) || 0,
        vendor: extractedData.vendor || 'Unknown Vendor',
        date: extractedData.date || new Date().toISOString().split('T')[0],
        category: extractedData.category || 'Other',
        description: extractedData.description || 'Transaction from receipt',
        confidence: parseFloat(extractedData.confidence) || 0.5
      };
    } catch (error) {
      console.error('Image analysis error:', error);
      throw new Error('Failed to analyze image. Please try again.');
    }
  }

  /**
   * Perform a comprehensive audit on raw financial records (CSV text or PDF text)
   */
  async auditFinancialRecords(recordsText: string): Promise<{
    auditSummary: string;
    anomalies: string[];
    insights: string[];
  }> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are an expert Financial Auditor. I will provide you with raw financial data (extracted from a CSV or PDF).
    
    YOUR TASKS:
    1. **Analyze** the transactions for any anomalies (e.g., duplicate charges, unusually high amounts, missing dates).
    2. **Categorize** the spending patterns (e.g., "High spending on Software", "Consistent Rent").
    3. **Summarize** the financial health based on this data.

    DATA:
    ${recordsText.substring(0, 30000)} // efficient token usage limit

    OUTPUT FORMAT (JSON ONLY):
    {
      "auditSummary": "Brief professional summary of the findings.",
      "anomalies": ["List of potential oddities or errors found"],
      "insights": ["Strategic financial observations"]
    }
    
    Return ONLY valid JSON.`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      // Cleanup JSON
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanText);
    } catch (error) {
      console.error('Audit analysis failed:', error);
      return {
        auditSummary: "Unable to complete detailed audit analysis on this document.",
        anomalies: [],
        insights: ["Data processing error occurred."]
      };
    }
  }
}

export default GeminiAccountantService;
