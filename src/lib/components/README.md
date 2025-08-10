# Components Structure

This directory contains all UI components organized by feature/page:

## 📁 `/auth`
Authentication-related components:
- `LoginForm.svelte` - Login, signup, and password reset forms

## 📁 `/business` 
Business registration and management components:
- `GoogleBusinessSearch.svelte` - Google Maps Places API integration for business search

## 📁 `/dashboard`
Main dashboard and analytics components:
- `Dashboard.svelte` - Main dashboard with business stats, queries, and analytics

## 📁 `/layout` 
Shared layout components (existing):
- Header, navigation, and other layout elements

## Usage

Each folder has an `index.ts` file for cleaner imports:

```typescript
// Instead of:
import LoginForm from '../components/auth/LoginForm.svelte'

// You can use:
import { LoginForm } from '../components/auth'
```

## Component Guidelines

- Each component should be self-contained and focused on a specific feature
- Use TypeScript interfaces for props and state
- Follow Svelte 5 runes syntax (`$state`, `$props`, etc.)
- Include accessibility attributes (`for` on labels, etc.)
- Use Tailwind CSS for styling
