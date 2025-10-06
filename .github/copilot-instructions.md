## Tech Stack
- **Framework**: SvelteKit 5 with runes (`$state`, `$derived`, `$effect`)
- **Database**: Supabase (PostgreSQL with RLS)
- **Styling**: Tailwind CSS
- **Type Safety**: TypeScript

## Architecture Principles

### Client/Server Separation
- **Server-side only**: All database queries, business logic, sensitive operations
- **Client-side only**: UI reactivity, form submissions, auth listeners
- **Browser Supabase client**: ONLY for authentication operations (`signIn`, `signUp`, `signOut`)
- **Server Supabase client**: For all data operations (via `locals.supabase`)

### Data Flow
- Page data loads via `+page.server.ts` (server-side)
- Mutations via form actions in `+page.server.ts` 
- Real-time updates via server API endpoints (e.g., `/api/analysis-status/[id]`)
- Client polls server APIs, never queries database directly

## Project Structure
```
/src/lib/components  - Reusable UI components
/src/lib/services    - Server-side service layer (DatabaseService, AnalysisService)
/src/lib/utils       - Utility functions
/src/routes/         - SvelteKit pages and API endpoints
/src/routes/api/     - Server API endpoints (protected with auth)
```

## Code Standards

### TypeScript
- Use interfaces for data models
- Prefer type inference where obvious
- Use `any` sparingly with `any` type annotation

### Components
- Keep components small and focused
- Use semantic HTML elements
- Extract repeated UI into shared components

### Styling
- Tailwind utility classes over custom CSS
- Interactive elements must have `cursor-pointer` (or use `Button.svelte`)
- Disabled states use `disabled:cursor-not-allowed`

### Security
- Never log sensitive data (passwords, tokens, emails)
- All error messages sanitized before sending to client
- Authorization checks on all protected routes/endpoints
- Use structured logging: `console.log('[Category] Context: Message', { metadata })`

## Logging Format
```typescript
// Info logs
console.log('[Action] runAnalysis: Starting', { businessId })

// Error logs  
console.error('[API] endpoint: Error', { error: err?.message })
```

Categories: `[API]`, `[Load]`, `[Action]`, `[Auth]`, `[Service]`

## Before Complex Changes
Create a `.md` file describing the plan, especially for multi-file changes.

## Environment Variables
Prefix with `VITE_` for client-side access, otherwise server-only by default.
