# How to Push Your Code to GitHub

Your code is now ready to push! Follow these steps:

## Step 1: Create a New Repository on GitHub

1. Go to https://github.com
2. Click the **"+"** icon in the top right
3. Select **"New repository"**
4. Fill in:
   - **Repository name**: `audit-ai-backend` (or any name you prefer)
   - **Description**: "Backend for AUDIT AI - AI Accountant Application"
   - **Visibility**: Choose **Private** or **Public**
   - **DO NOT** check "Initialize with README" (we already have code)
5. Click **"Create repository"**

## Step 2: Copy Your Repository URL

After creating the repository, GitHub will show you a page with setup instructions.

Copy the URL that looks like:

```
https://github.com/YOUR_USERNAME/audit-ai-backend.git
```

## Step 3: Push Your Code

Open a new terminal in the backend folder and run these commands:

```bash
# Add GitHub as remote (replace with YOUR repository URL)
git remote add origin https://github.com/YOUR_USERNAME/audit-ai-backend.git

# Rename branch to main (if needed)
git branch -M main

# Push code to GitHub
git push -u origin main
```

**Note**: You may be prompted to log in to GitHub. Use your GitHub username and password (or personal access token).

## Step 4: Verify

Go back to your GitHub repository page and refresh. You should see all your code!

---

## Troubleshooting

### Authentication Error

If you get an authentication error, you need to create a Personal Access Token:

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name: "AUDIT AI Backend"
4. Select scopes: Check **"repo"** (full control of private repositories)
5. Click "Generate token"
6. **Copy the token** (you won't see it again!)
7. Use this token as your password when pushing

### Already Exists Error

If you get "remote origin already exists":

```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/audit-ai-backend.git
git push -u origin main
```

---

## Next Steps

After pushing to GitHub:

1. Go to https://railway.app
2. Sign up/login
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your `audit-ai-backend` repository
5. Railway will automatically deploy!

Need help? Let me know! 🚀
