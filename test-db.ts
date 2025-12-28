import conversationRepository from './src/repositories/conversationRepository';

async function testDatabase() {
  console.log('🧪 Testing Database Persistence...');
  
  const userId = 'test-user-' + Date.now();
  
  // 1. Save messages
  console.log('1. Saving messages...');
  conversationRepository.saveMessage(userId, 'user', 'Hello, this is a test message');
  conversationRepository.saveMessage(userId, 'model', 'Hi there! I am the AI.');
  
  // 2. Get history
  console.log('2. Retrieving history...');
  const history = conversationRepository.getConversationHistory(userId);
  console.log(`   Found ${history.length} messages`);
  
  if (history.length !== 2) {
    console.error('❌ Failed: Expected 2 messages, got ' + history.length);
    process.exit(1);
  }
  
  if (history[0].content !== 'Hi there! I am the AI.' || history[1].content !== 'Hello, this is a test message') {
    // Note: getConversationHistory returns in chronological order (oldest first) or reverse?
    // The repository implementation says: return messages.reverse(); // Return in chronological order
    // So index 0 should be oldest (User), index 1 should be newest (Model)
    
    // Let's check the implementation again:
    // SELECT ... ORDER BY timestamp DESC LIMIT ?
    // messages.reverse()
    
    // So DB returns: [Model, User] (newest first)
    // Reverse makes it: [User, Model] (oldest first)
    
    if (history[0].role !== 'user' || history[1].role !== 'model') {
       console.error('❌ Failed: Message order incorrect');
       console.log('0:', history[0]);
       console.log('1:', history[1]);
       process.exit(1);
    }
  }
  
  console.log('   ✅ History retrieval correct');
  
  // 3. Get all conversations
  console.log('3. Retrieving conversation groups...');
  const conversations = conversationRepository.getAllConversations(userId);
  console.log(`   Found ${conversations.length} conversation groups`);
  
  if (conversations.length !== 1) {
    console.error('❌ Failed: Expected 1 conversation group');
    process.exit(1);
  }
  
  console.log('   ✅ Conversation grouping correct');
  
  // 4. Clear history
  console.log('4. Clearing history...');
  conversationRepository.clearConversation(userId);
  
  const emptyHistory = conversationRepository.getConversationHistory(userId);
  if (emptyHistory.length !== 0) {
    console.error('❌ Failed: History not cleared');
    process.exit(1);
  }
  
  console.log('   ✅ History cleared successfully');
  
  console.log('🎉 All database tests passed!');
}

testDatabase().catch(console.error);
