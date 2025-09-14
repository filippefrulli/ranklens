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

## Interaction & Accessibility Conventions
- All interactive elements (buttons, clickable anchors styled as buttons, icon buttons) must include the Tailwind `cursor-pointer` class unless they are disabled.
- The shared `Button.svelte` component already includes `cursor-pointer`; add it manually when using raw `<button>` or `<a>` elements.
- Disabled states should pair `disabled:cursor-not-allowed` (already in `Button.svelte`) to signal non-interaction.
