# URGENT: Update Your API Key

## ⚠️ SECURITY WARNING

You shared your API key publicly in the chat. This key needs to be revoked immediately!

**Exposed Key**: AIzaSyB2LbB6OPbjzZ4M-X7Gnbdz7NcHSWqR6zU

## What to Do NOW:

1. **Revoke this key immediately**:

   - Go to: https://aistudio.google.com/app/apikey
   - Find and DELETE: `AIzaSyB2LbB6OPbjzZ4M-X7Gnbdz7NcHSWqR6zU`

2. **Generate a NEW key**:

   - Click "Create API Key"
   - Copy the new key
   - **DO NOT share it anywhere!**

3. **Update your .env file**:

   - Open: `backend/.env`
   - Update this line:
     ```
     GEMINI_API_KEY=YOUR_NEW_KEY_HERE
     ```
   - Save the file

4. **Restart your backend server**:
   - Stop the current server (Ctrl+C)
   - Run: `npm run dev`

## Important Security Rules:

❌ **NEVER**:

- Share API keys in chat
- Post API keys in messages
- Commit API keys to git
- Put API keys in code files

✅ **ALWAYS**:

- Keep API keys in `.env` files only
- Add `.env` to `.gitignore` (already done)
- Use environment variables in code
- Treat API keys like passwords

## For Railway Deployment:

When you deploy to Railway, add the NEW key there:

1. Railway Dashboard → Your Service
2. Variables tab
3. Add: `GEMINI_API_KEY` = your_new_key

---

**Remember**: API keys are like passwords. Never share them publicly!
