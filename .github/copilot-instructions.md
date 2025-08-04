<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# RankLens Project Instructions

This is a SvelteKit project with the following technology stack:

## Tech Stack
- **Framework**: SvelteKit with TypeScript
- **Styling**: Tailwind CSS for utility-first styling
- **Backend**: Supabase for database and authentication
- **Build Tool**: Vite

## Code Style Guidelines
- Use TypeScript for type safety
- Prefer Tailwind CSS classes over custom CSS
- Use Svelte 5's runes syntax ($state, $derived, etc.)
- Keep components small and focused
- Use semantic HTML elements

## Project Structure
- `/src/lib/` - Reusable components and utilities
- `/src/lib/supabase.ts` - Supabase client configuration
- `/src/routes/` - SvelteKit routes (pages)
- Environment variables should be prefixed with `VITE_`

## Best Practices
- Always handle Supabase errors gracefully
- Use reactive statements for derived values
- Implement proper loading states for async operations
- Follow accessibility best practices
- Use TypeScript interfaces for data models
