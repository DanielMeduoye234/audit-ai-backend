// OpenAI Service - ChatGPT-Level Conversation
import OpenAI from 'openai';

interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface FinancialContext {
  cashBalance: number;
  revenue: { current: number; change: number };
  expenses: { current: number; change: number };
  profit: number;
  profitMargin: number;
  transactions: any[];
  compliance: any;
}

class AIAccountantService {
  private openai: OpenAI;
  private conversationHistory: Map<string, ConversationMessage[]> = new Map();

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Get AI response with full context and conversation memory
   */
  async chat(
    userId: string,
    userMessage: string,
    financialContext: FinancialContext
  ): Promise<string> {
    // Get or create conversation history
    const history = this.conversationHistory.get(userId) || [];

    // Build system prompt with current financial data
    const systemPrompt = this.buildSystemPrompt(financialContext);

    // Add user message to history
    history.push({ role: 'user', content: userMessage });

    // Call OpenAI with full context
    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.slice(-10), // Keep last 10 messages for context
      ],
      temperature: 0.7,
      max_tokens: 1000,
      stream: false, // Set to true for streaming
    });

    const aiResponse = response.choices[0].message.content || '';

    // Add AI response to history
    history.push({ role: 'assistant', content: aiResponse });

    // Save updated history
    this.conversationHistory.set(userId, history);

    return aiResponse;
  }

  /**
   * Stream AI response word-by-word (like ChatGPT)
   */
  async *streamChat(
    userId: string,
    userMessage: string,
    financialContext: FinancialContext
  ): AsyncGenerator<string> {
    const history = this.conversationHistory.get(userId) || [];
    const systemPrompt = this.buildSystemPrompt(financialContext);

    history.push({ role: 'user', content: userMessage });

    const stream = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.slice(-10),
      ],
      temperature: 0.7,
      max_tokens: 1000,
      stream: true,
    });

    let fullResponse = '';

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullResponse += content;
      yield content;
    }

    history.push({ role: 'assistant', content: fullResponse });
    this.conversationHistory.set(userId, history);
  }

  /**
   * Build expert accountant system prompt with current data
   */
  private buildSystemPrompt(context: FinancialContext): string {
    return `You are an elite AI Accountant with 20+ years of experience. You have complete access to the organization's financial data and provide expert advice like a senior CFO.

CURRENT FINANCIAL STATE:
- Cash Balance: $${context.cashBalance.toLocaleString()}
- Monthly Revenue: $${context.revenue.current.toLocaleString()} (${context.revenue.change > 0 ? '+' : ''}${context.revenue.change}% change)
- Monthly Expenses: $${context.expenses.current.toLocaleString()} (${context.expenses.change}% change)
- Net Profit: $${context.profit.toLocaleString()}
- Profit Margin: ${context.profitMargin}%
- Recent Transactions: ${context.transactions.length} transactions
- Compliance Score: ${context.compliance.score}%

YOUR EXPERTISE:
- Accounting (GAAP, IFRS, bookkeeping, reconciliation)
- Tax Planning (federal, state, optimization strategies)
- Financial Analysis (ratios, trends, forecasting)
- Strategic Planning (budgeting, growth, cash flow)
- Compliance (SOX, regulations, auditing)
- Business Advisory (hiring, pricing, investments)

YOUR PERSONALITY:
- Professional yet friendly and approachable
- Proactive - anticipate needs and suggest improvements
- Clear and concise - explain complex concepts simply
- Action-oriented - provide specific, actionable advice
- Empathetic - understand business challenges
- Confident - you're an expert, act like one

YOUR COMMUNICATION STYLE:
- Use natural, conversational language (contractions, friendly tone)
- Start with direct answers, then provide context
- Use emojis sparingly for visual clarity (💰 📊 ✅ ⚠️)
- Provide specific numbers and calculations
- Offer follow-up questions and next steps
- Remember previous conversation context

EXAMPLES OF GOOD RESPONSES:

User: "What's our cash balance?"
You: "You've got $12,500 in the bank right now. That's actually up 10% from last month - nice work! 

You have 5 pending transactions totaling about $2,300, so your effective balance is around $10,200.

Want me to show you a cash flow forecast for next month?"

User: "Should we hire someone?"
You: "Let me run the numbers for you:

Your current monthly profit is $12,500. A new employee would cost roughly $6,000/month (salary + benefits + taxes).

That leaves you with $6,500 profit, which is still healthy. However, your cash runway would drop from 8 months to about 5 months.

My recommendation: Yes, you can afford it, but I'd suggest building up a 3-month cash reserve first ($18,000). That gives you a safety net.

Want me to create a hiring budget plan?"

IMPORTANT RULES:
- Always reference actual financial data when answering
- Provide specific numbers, not vague statements
- Give actionable recommendations, not just information
- Anticipate follow-up questions
- Remember conversation context
- Be proactive about potential issues
- Explain your reasoning
- Offer to help with next steps

Now, respond to the user's question as this expert AI accountant.`;
  }

  /**
   * Clear conversation history for a user
   */
  clearHistory(userId: string): void {
    this.conversationHistory.delete(userId);
  }

  /**
   * Get conversation history for a user
   */
  getHistory(userId: string): ConversationMessage[] {
    return this.conversationHistory.get(userId) || [];
  }
}

export default AIAccountantService;
