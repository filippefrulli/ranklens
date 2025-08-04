# RankLens Database Setup Guide

This guide will help you set up your Supabase database for RankLens.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new account
2. Create a new project
3. Wait for the database to be provisioned (usually 1-2 minutes)

## 2. Get Your Project Credentials

1. Go to Settings → API in your Supabase dashboard
2. Copy your Project URL and anon/public key
3. Add these to your `.env` file:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 3. Run the Database Schema

1. Go to the SQL Editor in your Supabase dashboard
2. Copy the entire contents of `database/schema.sql`
3. Paste and run the SQL script

This will create:
- All necessary tables (projects, queries, llm_providers, ranking_results)
- Row Level Security policies
- Default LLM provider records
- Proper indexes for performance

## 4. Enable Authentication (Optional)

If you want to use Supabase Auth:

1. Go to Authentication → Settings in your Supabase dashboard
2. Configure your preferred authentication providers
3. Update the site URL if deploying to production

## 5. Test the Connection

1. Start your development server: `npm run dev`
2. The app will automatically test the Supabase connection
3. You should see a "Connected to Supabase!" message

## 6. Get LLM API Keys

To use the ranking analysis features, you'll need API keys from:

### Required for Full Functionality:
- **OpenAI**: [platform.openai.com](https://platform.openai.com/api-keys)
- **Anthropic**: [console.anthropic.com](https://console.anthropic.com/)
- **Google AI**: [ai.google.dev](https://ai.google.dev/)
- **Cohere**: [dashboard.cohere.ai](https://dashboard.cohere.ai/)
- **Perplexity**: [www.perplexity.ai/settings/api](https://www.perplexity.ai/settings/api)

Add these to your `.env` file:

```env
VITE_OPENAI_API_KEY=sk-...
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_GOOGLE_API_KEY=AI...
VITE_COHERE_API_KEY=...
VITE_PERPLEXITY_API_KEY=pplx-...
```

## 7. Database Schema Overview

### Tables:
- **projects**: Business projects with metadata
- **queries**: Search queries for each project (max 5 per project)
- **llm_providers**: LLM service configurations
- **ranking_results**: Raw ranking data from LLM responses

### Security:
- Row Level Security ensures users only see their own data
- Authentication required for all data access
- API keys stored securely as environment variables

## Troubleshooting

### Connection Issues:
- Verify your Supabase URL and anon key are correct
- Check that your project is active in the Supabase dashboard
- Ensure you're using the correct environment variable names (VITE_ prefix)

### Schema Issues:
- Make sure you ran the complete schema.sql file
- Check the Supabase logs for any SQL errors
- Verify that RLS policies are enabled

### API Issues:
- Ensure your LLM API keys are valid and have sufficient credits
- Check the browser console for any CORS or authentication errors
- Verify the API endpoint URLs in the llm_providers table

## Next Steps

Once your database is set up:
1. Create your first project in the RankLens app
2. Add relevant search queries for your business
3. Run your first ranking analysis
4. Explore the analytics dashboard

Need help? Check the main README.md for more information.
