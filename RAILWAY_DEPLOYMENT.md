# Railway Deployment Guide for AUDIT AI Backend

## Prerequisites

1. GitHub account
2. Railway account (sign up at https://railway.app)
3. Your code pushed to GitHub

---

## Step 1: Push Code to GitHub

```bash
# Initialize git (if not already done)
cd backend
git init
git add .
git commit -m "Initial commit - AUDIT AI Backend"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/audit-ai-backend.git
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy to Railway

### A. Create New Project

1. Go to https://railway.app
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your `audit-ai-backend` repository
5. Railway will auto-detect it's a Node.js app

### B. Configure Environment Variables

Click on your service → **Variables** tab → Add these:

```env
NODE_ENV=production
PORT=5000
GEMINI_API_KEY=your_gemini_api_key_here
USE_MOCK_AI=false

# Optional: Email configuration
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

**Important**: Don't include `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` since we're using pure backend now.

### C. Deploy

Railway will automatically:

1. Install dependencies (`npm install`)
2. Build your app (`npm run build`)
3. Start your server (`npm start`)

---

## Step 3: Get Your Backend URL

After deployment:

1. Go to your service in Railway
2. Click **Settings** → **Networking**
3. Click **Generate Domain**
4. You'll get a URL like: `https://your-app.up.railway.app`

---

## Step 4: Update Frontend

Update your frontend to use the Railway backend URL:

**File**: `frontend/.env`

```env
VITE_API_BASE_URL=https://your-app.up.railway.app
```

**File**: `frontend/src/lib/api.ts`

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
```

---

## Step 5: Deploy Frontend to Vercel

```bash
cd frontend
npm install -g vercel
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? audit-ai-frontend
# - Directory? ./
# - Override settings? No
```

Add environment variable in Vercel dashboard:

```
VITE_API_BASE_URL=https://your-app.up.railway.app
```

---

## Monitoring & Costs

### Check Usage

- Railway Dashboard → Your Project → **Usage**
- Monitor your $5 free credit

### Set Spending Limit

- Project Settings → **Usage Limits**
- Set max spend to $10/month (safety net)

### Expected Costs

- **Development**: ~$3-5/month (within free credit)
- **Production**: ~$7-12/month (if you exceed free credit)

---

## Troubleshooting

### Build Fails

Check Railway logs:

- Click on your service
- Go to **Deployments** tab
- Click latest deployment
- View build logs

Common issues:

- Missing `build` script in `package.json` ✅ (You have it)
- Missing dependencies ✅ (All good)
- TypeScript errors → Fix and push again

### App Crashes

Check runtime logs:

- **Deployments** → Click deployment → **View Logs**

Common issues:

- Missing environment variables
- Port binding (Railway sets `PORT` automatically)
- Database connection (not applicable for in-memory)

---

## Next Steps (Optional)

### Add PostgreSQL Database

1. Railway Dashboard → **New** → **Database** → **PostgreSQL**
2. Railway auto-creates `DATABASE_URL` variable
3. Update your repositories to use PostgreSQL instead of in-memory
4. Data will persist across deployments

### Enable Auto-Deploy

Already enabled by default! Every `git push` to main branch triggers a new deployment.

### Custom Domain

1. Railway Settings → **Networking**
2. Add your custom domain
3. Update DNS records as shown

---

## Summary

✅ **Railway.json** created
✅ **Package.json** has build scripts
✅ **Ready to deploy**

**Next**: Push to GitHub and deploy to Railway following the steps above!

Need help with any step? Let me know! 🚀
