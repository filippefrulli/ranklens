# Redesign Phase 2 Plan

## Scope
Applies consistent visual language (cards, gradients, brand colors, Poppins, pill filters) to remaining public & auth-facing pages.

## Pages / Areas
1. Authentication (signin, legacy auth/login)
2. Unauthenticated landing (root when no user)
3. Onboarding / business registration (in-dashboard state)
4. Shared UI atoms (Card, Button) to reduce duplication
5. Accessibility / polish pass (focus, aria, contrast)

## Design Tokens Used
- Font: `font-sans` (Poppins)
- Radius: `rounded-xl`
- Surfaces: `bg-white`, subtle borders `border-slate-200`, soft shadow `shadow-sm` / `shadow-soft`
- Accent / Brand: `brand-600` primary, hover `brand-700`, subtle `brand-50`
- Gradients: background page wrapper `bg-gradient-to-br from-slate-50 to-blue-50`

## Component Atoms (to add)
- `Card`: Wrapper with padding + border + radius + optional header slot
- `Button`: Variants (primary, secondary, subtle, danger) with size + loading state

## Accessibility Goals
- Minimum contrast 4.5:1 for body text
- Focus ring: `outline-none ring-2 ring-offset-2 ring-brand-500` on interactive elements
- Provide `aria-label` for icon-only buttons

## Implementation Order
1. Create atoms (Card, Button) - low risk
2. Refactor authentication pages to use atoms
3. Refactor landing hero & sections
4. Polish onboarding registration container
5. Add accessibility adjustments

## Success Criteria
- No mixed legacy/modern styles on targeted pages
- Reduced duplicated utility strings (>25% reduction around buttons/cards)
- All interactive elements keyboard navigable and clearly focused

## Follow-ups (Not in this phase)
- Dark mode
- Motion / micro-interactions
- Theming via CSS variables

