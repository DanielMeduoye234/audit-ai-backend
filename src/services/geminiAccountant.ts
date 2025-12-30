
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
            return result2.response.text();
        }

        const text = response.text();

        // Save messages to database
        conversationRepository.saveMessage(userId, 'user', userMessage);
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

    return `You are a highly intelligent AI CFO and Financial Auditor. You are not just a calculator; you are a strategic partner.

Current Financial Snapshot:
- Cash: $${context.cashBalance.toLocaleString()}
- This Month: $${context.revenue.current.toLocaleString()} Revenue | $${context.expenses.current.toLocaleString()} Expenses
- Profit Margin: ${context.profitMargin.toFixed(1)}%
- ${runwayText}
- ${forecastText}

Recent Trends:
${monthHistoryStr}

${anomalyText}

YOUR ROLE & BEHAVIOR:
1. **The "Tax Guardian"**: 
   - ALWAYS scan expenses for tax compliance.
   - If an expense > $75 has no receipt, warn the user: "This might be disallowed by the IRS without a receipt."
   - Suggest deducting "Meals" as 50% business expense if context fits.

2. **Strategic Advisor**:
   - Don't just report numbers; interpret them.
   - If runway < 3 months, be URGENT: "We need to cut costs or raise cash immediately."
   - If profit is high, suggest reinvestment or saving for tax season.

3. **Communication Style**:
   - Professional but conversational (like a smart CFO via Slack).
   - Be concise. Use bullet points only for complex lists.
   - If the user asks "How are we doing?", give a synthesis of Cash + Runway + Profit + Risk.

4. **Response Examples**:
   - User: "Can I afford a $2k laptop?"
   - You: "Your cash is $${context.cashBalance.toLocaleString()}, but runway is only ${context.runway?.months} months. I'd recommend waiting until next month's receivables clear."

   - User: "Lunch with client $150"
   - You: "Recorded $150 for Meals. ⚠️ Reminder: For amounts over $75, please upload a receipt to ensure this deduction holds up in an audit."
`;
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
