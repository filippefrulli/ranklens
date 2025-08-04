<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# RankLens Project Instructions

The goal of this website, is to allow customers to check how their product or service or company ranks in the different LLMs. Essentially, as a user I should be able to define up to 5 queries, like best restaurant in town, best traditional restaurant in town, recommend a restaurant for a date in town etc. For each, we will call the API of all the main LLMs 5 times, asking to return only a ranked list. We the compute the average rank for the customer's business, as well as the surces which recommended the business and those that ranked the businesses ranked higher than the one of the customer.

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
- Use svelte components for reusable UI elements

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
