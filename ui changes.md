# UI Alignment Notes

Recent UI changes to the authentication flow:

1. Recreated the Airtable-style sign-in layout with the Omni promo panel, responsive breakpoints, and a Google-only server action (`src/app/sign-in/page.tsx`).
2. Mirrored Airtable's welcome/sign-up experience with matching typography, footer copy, and marketing opt-in (`src/app/sign-up/page.tsx`).
3. Centralized shared components for buttons, dividers, brand icons, and the Airtable logo to guarantee parity across pages (`src/components/auth/auth-ui.tsx`).
4. Added a shared client-side email capture form that toggles the call-to-action button styling when text is entered (`src/components/auth/email-capture-form.tsx`).
5. Integrated the Omni hero art with hover scaling and removed custom gradients/borders so it matches the reference asset (`public/omni_signin_large@2x.png` usage in sign-in).

New in-app workspace shell:

6. Rebuilt the authenticated layout with a light Airtable-style sidebar, quick search top bar, and profile controls (`src/components/nav/AppSidebar.tsx`, `src/components/nav/AppTopBar.tsx`, `src/app/(app)/layout.tsx`).
7. Designed a Home dashboard that mirrors Airtable’s “Home” screen with quick-start cards, recency filters, and workspace cards sourced from the user’s bases (`src/app/(app)/page.tsx`).

Adjust spacing in the layouts by editing the Tailwind classes on the outer flex containers of each page. For example:
- Sign-in: change `px-6 py-16 lg:gap-32` in `src/app/sign-in/page.tsx`.
- Sign-up: update `px-6 py-12` in `src/app/sign-up/page.tsx`.
- Authenticated shell: tweak sidebar width or main padding via `src/app/(app)/layout.tsx` and `src/components/nav/AppSidebar.tsx`.

Button colors, hover shadows, or logo positioning can be updated in the shared components so both auth screens stay in sync.
