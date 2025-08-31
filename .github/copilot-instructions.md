## Code Style Guidelines
- Use TypeScript for type safety
- Prefer Tailwind CSS classes over custom CSS
- Use Svelte 5's runes syntax ($state, $derived, etc.)
- Keep components small and focused
- Use semantic HTML elements
- Use svelte components for reusable UI elements

## Project Structure
- `/src/lib/components` - Reusable components and utilities
- `/src/lib/supabase.ts` - Supabase client configuration
- `/src/routes/` - SvelteKit routes (pages)
- Environment variables should be prefixed with `VITE_`

## Best Practices
- Use reactive statements for derived values
- Implement proper loading states for async operations
- Use TypeScript interfaces for data models
- Make sure to use the server side when handling sensitive data or intensive tasks
- Before making changes that involve more than one file, create an .md file describing what you are planning to do!
