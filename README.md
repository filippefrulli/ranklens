# RankLens

**Track your business rankings across all major LLM platforms.**

RankLens helps businesses understand how they rank when customers ask AI assistants for recommendations. Get comprehensive analytics from OpenAI GPT-5 and Google Gemini

## 🎯 What RankLens Does

- **Multi-LLM Analysis**: Query 5 major LLM providers simultaneously
- **Custom Search Queries**: Define up to 5 business-relevant search queries
- **Automated Testing**: Each query runs 5 times per LLM for statistical accuracy
- **Ranking Analytics**: Calculate average rankings and identify top competitors
- **Competitor Intelligence**: See which businesses consistently rank higher
- **Source Attribution**: Track which LLMs mention your business most often

## 🚀 Tech Stack

- **Framework**: SvelteKit with TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL database + Auth)
- **Build Tool**: Vite

## 🛠️ Setup

### Prerequisites
- Node.js (v22+ recommended)
- Supabase account
- API keys for LLM providers (OpenAI, Google)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

3. Configure your `.env` file:
```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# LLM API Keys
OPENAI_API_KEY=your_openai_api_key
GOOGLE_API_KEY=your_google_api_key
```

4. Set up your Supabase database using the schema in `database/schema.sql`

### Development

Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

Create a production build:
```bash
npm run build
```

## 🏗️ Database Schema

The application uses the following main tables:

- **projects**: Store business projects and metadata
- **queries**: Custom search queries for each project  
- **llm_providers**: Configuration for LLM API endpoints
- **ranking_results**: Raw ranking data from LLM responses

See `database/schema.sql` for the complete schema with Row Level Security policies.

## 🔧 How It Works

1. **Project Setup**: Create a project for your business with industry and location
2. **Query Definition**: Add up to 5 search queries relevant to your business
3. **Automated Analysis**: The system queries each LLM provider 5 times per query
4. **Data Processing**: Results are parsed and target business rankings are calculated
5. **Analytics Dashboard**: View comprehensive ranking analytics and competitor insights

## � Features

### Dashboard Analytics
- Overall ranking statistics across all queries and LLMs
- Query-specific performance breakdown
- LLM provider comparison
- Competitor ranking analysis

### Ranking Intelligence
- Average ranking position across all providers
- Mention frequency and consistency
- Competitor identification and ranking comparison
- Source attribution (which LLMs mention your business)

### Business Intelligence
- Industry-specific query optimization
- Location-based ranking variations
- Historical performance tracking
- Competitive landscape analysis

## 🔐 Security

- Row Level Security (RLS) enabled on all user data
- API keys stored as environment variables
- User authentication via Supabase Auth
- Data isolation per user account

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
