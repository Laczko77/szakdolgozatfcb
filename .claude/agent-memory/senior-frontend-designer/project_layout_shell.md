---
name: Layout shell — navbar / mobile header / bottom tab bar are mounted in root layout
description: F2 wired persistent nav into src/app/layout.tsx; pages should NOT render their own headers
type: project
---

The persistent navigation shell (desktop pill `Navbar`, mobile sticky `MobileHeader`, fixed `BottomTabBar`) is mounted globally inside `src/app/layout.tsx`, **inside** `<ThemeProvider>` and `<ToastProvider>`.

**Why:** the navbar consumes `useTheme()` for the toggle and `useToast()` is available to any nested click handler; mounting outside the providers would break those hooks. Page-level layouts must NOT add their own top-level headers — only nested section headers below the shell.

**How to apply:**
- `<main>` in the root layout sets `pt-2 pb-20 md:pt-4 md:pb-0`. Don't fight this padding from page components — instead use it as the baseline and add additional spacing inside the page.
- The navbar links live in `src/components/layout/navigation.config.ts`. Adding/removing a route means updating that file — both desktop and mobile read from the same source.
- Active-route logic uses the helper `isRouteActive(href, pathname)` from the same config file. It treats `/` exactly and uses `pathname === href || startsWith(`${href}/`)` for everything else, so detail pages keep their parent tab highlighted.
- The desktop navbar uses a `data-scrolled="true|false"` attribute driven by `useScrollPosition()` (rAF-coalesced) with a 20px threshold. Glass materializes via Tailwind `data-[scrolled=true]:` variants on background, border, blur, and shadow — no inline style juggling needed.
- Avatar fallback (`buildInitials`) reads `user_metadata.display_name` / `full_name` / `name`, then falls back to the email local-part. If you add a profile-edit screen, store the chosen display name under one of those keys so the avatar updates automatically.
