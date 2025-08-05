# Google OAuth Setup Guide for RankLens

## 1. Google Cloud Console Setup

### Create Google OAuth Credentials:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `https://your-project-id.supabase.co/auth/v1/callback`
     - `http://localhost:5173/auth/callback` (for development)

## 2. Supabase Configuration

### Enable Google Provider:
1. Go to your Supabase dashboard
2. Navigate to Authentication > Providers
3. Enable Google provider
4. Add your Google OAuth credentials:
   - **Client ID**: From Google Cloud Console
   - **Client Secret**: From Google Cloud Console
5. Set redirect URL: `https://your-project-id.supabase.co/auth/v1/callback`

## 3. Update Your Environment Variables

Add to your `.env` file:
```env
# Existing Supabase config
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Site URL for redirects
VITE_SITE_URL=http://localhost:5173
```

## 4. Test the Setup

After implementing the auth components, test:
1. Click "Sign in with Google"
2. Complete Google OAuth flow
3. Verify user is created in Supabase Auth > Users
4. Check that RLS policies allow access to user's own data

## Notes:
- For production, update redirect URIs to your production domain
- Google OAuth requires HTTPS in production
- Users will be automatically created in your Supabase auth.users table
