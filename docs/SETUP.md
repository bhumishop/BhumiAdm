# Setup Guide - BhumiAdm Admin Panel

## Quick Start

### 1. Environment Configuration

Copy `.env.example` to `.env` and configure the required values:

```bash
cp .env.example .env
```

### 2. Supabase Setup

1. Create a project at [Supabase](https://supabase.com)
2. Go to **Project Settings > API**
3. Copy the **Project URL** and **anon/public key**
4. Add to your `.env`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_KEY=your-anon-key
   ```

### 3. Google OAuth Setup (Required for Admin Login)

The admin panel uses Google OAuth for authentication. You **must** configure this to log in.

#### Step-by-Step Instructions:

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Create a new project or select existing

2. **Enable Google+ API**
   - Go to **APIs & Services > Library**
   - Search for "Google+ API" and enable it

3. **Create OAuth Credentials**
   - Go to **APIs & Services > Credentials**
   - Click **Create Credentials > OAuth client ID**
   - If prompted, configure the OAuth consent screen first:
     - User Type: **External** (or Internal if using Google Workspace)
     - App name: **BhumiAdm**
     - User support email: Your email
     - Developer contact: Your email

4. **Configure OAuth Client**
   - Application type: **Web application**
   - Name: **BhumiAdm Admin**
   - **Authorized JavaScript origins**:
     - Development: `http://localhost:5173`
     - Production (GitHub Pages): `https://yourusername.github.io`
     - Custom domain: `https://yourdomain.com`
   - **DO NOT** add Authorized redirect URIs (One Tap doesn't need it)

5. **Copy Client ID**
   - Copy the generated Client ID (format: `xxxxxxxx.apps.googleusercontent.com`)
   - Add to your `.env`:
     ```
     VITE_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
     ```

6. **Add Admin User to Database**
   - Only emails in the `admin_users` table can log in
   - Run this SQL in Supabase SQL Editor:
     ```sql
     INSERT INTO admin_users (email, name, role)
     VALUES ('your-email@example.com', 'Your Name', 'admin');
     ```

### 4. GitHub CDN Setup (for Product Images)

1. Create a GitHub repository (e.g., `BhumiAdm`)
2. Create a `cdn` branch
3. Add to `.env`:
   ```
   VITE_GITHUB_OWNER=YourUsername
   VITE_GITHUB_REPO=YourRepo
   VITE_CDN_BRANCH=cdn
   ```

### 5. Run the Application

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

## Troubleshooting

### "Google OAuth not configured" Error

- Make sure `VITE_GOOGLE_CLIENT_ID` doesn't contain `YOUR_` or `your-`
- Restart the dev server after changing `.env`

### "401 Unauthorized" Errors

- You need to log in first at `/login`
- Make sure your email is in the `admin_users` table
- Check that Supabase URL and key are correct

### "Cross-Origin-Opener-Policy" Warning

- This is a browser development warning and can be ignored
- It doesn't affect functionality

### Can't See Google Sign-In Button

1. Check browser console for configuration errors
2. Make sure you're on an authorized origin
3. Try disabling ad blockers

## Security Notes

- **NEVER** commit `.env` files to git
- **NEVER** use the service_role key in frontend code
- Only add trusted admin emails to the database
- Use HTTPS in production

## Additional Resources

- [Google OAuth Documentation](https://developers.google.com/identity/one-tap/web)
- [Supabase Documentation](https://supabase.com/docs)
- [GitHub Pages Deployment](https://pages.github.com/)
