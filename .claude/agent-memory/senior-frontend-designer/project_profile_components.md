---
name: Profile primitives (F10)
description: F10 unified profile shell at /profil with five tabs and command palette
type: project
---

F10 unified profile + global search shell.

**Why:** F10 needs all per-feature standalone pages (/jegyeim, /kuponjaim, /pontjaim) bundled into a single tabbed /profil shell, plus a Ctrl+K command palette across the app.

**How to apply:** When extending profile UX, route through these primitives:
- /profil page is `?tab=`-driven; legal ids are `orders | tickets | coupons | points | settings` (validated by `isProfileTabId`).
- ProfileHero handles avatar upload (multipart PUT /api/profile), inline username edit, and renders the points balance fed in via prop (no double fetch).
- Per-tab data is lazy-loaded on first activation; reused tabs (`MyTicketCard`, `RedeemedCouponCard`, `PointsTransactionList`) keep visual parity with their standalone pages.
- SettingsTab houses both the username and password forms. Password form posts to /api/profile/password and surfaces 401 on the current-password field.
- UserMenu's "Beállítások" link points to `/profil?tab=settings` (no separate /beallitasok route).

**Components:**
- src/lib/profile-api.ts — fetchProfile, updateProfile, changePassword, fetchPurchases, searchAll
- src/providers/SearchProvider.tsx — `useSearchPalette()` (open/close/toggle) + global Ctrl/Cmd+K binding
- src/components/search/CommandPalette.tsx — fullscreen overlay, 300ms debounced /api/search, grouped Hírek/Termékek/Játékosok/Posztok with keyboard nav
- src/components/profile/ProfileHero.tsx — avatar + inline username + balance card
- src/components/profile/ProfileTabs.tsx — pill-tab strip with `layoutId` gold indicator + arrow-key nav
- src/components/profile/{Orders,Tickets,Coupons,Points,Settings}Tab.tsx — five panels
- src/app/profil/page.tsx — orchestrator (ProtectedRoute + Suspense for useSearchParams)

**Wiring:**
- SearchProvider is mounted in src/app/layout.tsx INSIDE ConsentProvider; the CommandPalette renders as a sibling within it.
- Navbar + MobileHeader Search buttons call `useSearchPalette().open()`.
