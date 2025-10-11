# Landing Page Components

This folder contains reusable components for the landing page (unauthenticated view).

## Components

### Hero.svelte
The main hero section with headline, description, and CTA buttons.
- "Get Started" primary button
- "Learn More" secondary button

### LLMProviders.svelte
Displays supported LLM provider logos and names.
- Shows OpenAI and Gemini logos
- Imports from `$lib/constants/llm` for provider names

### FeatureCard.svelte
Reusable card component for displaying features.

**Props:**
- `iconName` - Icon identifier (from Icon component)
- `iconBgClass` - Background color class for icon container
- `iconTextClass` - Text color class for icon
- `title` - Feature title
- `description` - Feature description
- `ariaLabel` - Accessibility label for the icon

### Features.svelte
Container for all feature cards using the grid layout.
- Multi-LLM Coverage
- Ranking Analytics
- Smart Query Selection

### HowItWorks.svelte
Step-by-step explanation of the product workflow.
- 4-step process display
- Numbered badge design
- Responsive grid layout

### CTABand.svelte
Final call-to-action section with gradient background.
- "Create Free Account" button
- Encourages sign-up

## Usage

Import components in the main page:

```svelte
import Hero from "$lib/components/landing_page/Hero.svelte";
import LLMProviders from "$lib/components/landing_page/LLMProviders.svelte";
import Features from "$lib/components/landing_page/Features.svelte";
import HowItWorks from "$lib/components/landing_page/HowItWorks.svelte";
import CTABand from "$lib/components/landing_page/CTABand.svelte";

<Hero />
<LLMProviders />
<Features />
<HowItWorks />
<CTABand />
```

## Benefits

- **Reduced file size**: Main `+page.svelte` reduced from ~224 lines to ~80 lines
- **Reusability**: Components can be reused or modified independently
- **Maintainability**: Easier to update individual sections
- **Testing**: Smaller, focused components are easier to test
