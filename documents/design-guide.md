# BarcaPulse – Claude Code Implementációs Guide
> Ez a guide leírja, hogyan kell a `claude_code_prompts.md` fájl promptjait Claude Code-dal hatékonyan végrehajtani, a `frontend-design` skill és a projekt technikai architektúrájának figyelembevételével.
---
## 1. Előfeltételek
Mielőtt bármilyen promptot futtatnál, ellenőrizd az alábbiakat:
### Projekt struktúra
```
fcbweb/
├── app/
│   ├── (auth)/          # Login, Register
│   ├── (app)/           # Autentikált oldalak
│   └── (admin)/         # Admin felület
├── components/
│   ├── skeletons/       # Loading skeleton komponensek
│   └── ...              # Shared components
├── lib/                 # Supabase client, utilityk
└── globals.css          # CSS változók és globális stílusok
```
### Technológiai stack (be kell állítani)
- **Framework:** Next.js 14 (App Router)
- **Stílus:** Tailwind CSS + custom CSS változók
- **UI:** shadcn/ui (de 0px radius override-dal!)
- **Adatbázis:** Supabase (auth + realtime + storage)
- **Ikonok:** Lucide React
- **Animációk:** Framer Motion VAGY CSS keyframes
### Google Fonts beállítás (`app/layout.tsx`)
```typescript
import { Bebas_Neue, DM_Sans, Space_Mono } from 'next/font/google';
const bebasNeue = Bebas_Neue({ weight: '400', subsets: ['latin'] });
const dmSans = DM_Sans({ subsets: ['latin'] });
const spaceMono = Space_Mono({ weight: ['400', '700'], subsets: ['latin'] });
```
### `globals.css` – Kötelező CSS változók (ELSŐ LÉPÉS)
```css
:root {
  --bg-base: #1D1A31;
  --bg-card: #252240;
  --bg-element: #2E2B4A;
  --border-subtle: rgba(255, 255, 255, 0.07);
  --fcb-blue: #004D98;
  --fcb-crimson: #A50044;
  --fcb-gold: #EDBB00;
  --text-primary: #F5F0FF;
  --text-secondary: #9B97B8;
}
/* Noise grain texture – minden section-re alkalmazandó */
.noise-grain::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,..."); /* SVG feTurbulence */
  opacity: 0.04;
  pointer-events: none;
}
```
---
## 2. Workflow – Hogyan használd a promptokat
### A helyes sorrend
Az oldalak egymásra épülnek (shared komponensek újrafelhasználása miatt). Kövesd ezt a sorrendet:
```
1. globals.css + layout.tsx      → Design system alapok
2. Prompt 1: Navbar              → landing + NavbarAuth (shared)
3. Prompt 1: Landing Page        → teljes landing
4. Prompt 2: Login               → /login
5. Prompt 3: Register            → /register
6. Prompt 4: Dashboard           → /dashboard (NavbarAuth-ot már használja)
7. Prompt 5: Hírek Lista         → /news
8. Prompt 6: Hír Részlet         → /news/[id]
9. Prompt 7: Meccsek             → /matches
10. Prompt 8: Jegyvásárlás       → /tickets/[matchId]
11. Prompt 9: Játékosok Lista    → /players
12. Prompt 10: Játékos Részlet   → /players/[id]
13. Prompt 11: Webshop Lista     → /shop
14. Prompt 12: Termék Részlet    → /shop/[id]
15. Prompt 13: Kosár             → /shop/cart
16. Prompt 14: Szavazások        → /community/polls
17. Prompt 15: Chat              → /community/chat
18. Prompt 16: Profil            → /profile
19. Prompt 17: Chatbot Widget    → components/ChatbotWidget.tsx
20. Prompt 18: Admin Dashboard   → /admin
21. Prompt 19: Admin Hírek       → /admin/news
22. Prompt 20: Admin Hír Form    → /admin/news/new
23. Prompt 21: Admin Termékek    → /admin/products
24. Prompt 22: Admin Jegyek      → /admin/matches
25. Prompt 23: Admin Játékosok   → /admin/players
26. Prompt 24: Admin Szavazások  → /admin/polls
27. Prompt 25: Skeleton States   → components/skeletons/*
```
---
## 3. Hogyan adj promptot Claude Code-nak
### A helyes prompt struktúra
Minden promptot így küldj Claude Code-nak:
```
Olvasd el a `skill.txt` fájlt a workspace gyökerében, majd végezd el az alábbi implementációt pontosan betartva a benne foglalt BarcaPulse design elveket:
[Ide másolod a claude_code_prompts.md megfelelő PROMPT X szekcióját]
Fontos: 
- Használj már létező shared komponenseket (pl. NavbarAuth, ha már létezik)
- Ne változtass meglévő globals.css CSS változókon
- Ha új komponenst hozol létre, tedd a components/ mappába
- TypeScript-et használj
```
### Skill aktiválása
Claude Code automatikusan megtalálja a `skill.txt`-et ha a workspace gyökerében van. De explicit is hivatkozhatsz rá:
```
A skill.txt irányelvei alapján valósítsd meg...
```
---
## 4. Kritikus Design Szabályok (ne feledd ezeket!)
> [!CAUTION]
> Ezeket a szabályokat NEM szabad megsérteni. Ha Claude Code nem tartja be őket, kérd a javítást.
| Szabály | Helyes | TILOS |
|---------|--------|-------|
| Border radius | `0px` mindenhol | Bármilyen `rounded-*` Tailwind class |
| Fejléc font | `Bebas Neue` | `Inter`, `Roboto`, `Arial`, `font-sans` default |
| Háttér | `#1D1A31` base | `#000`, `#111`, `bg-black` |
| Gombok | Square, 0px radius | `rounded`, `pill` shape |
| Input stílus | Underline (bottom border only) | Full border box input |
| Hibák | Inline Space Mono szöveg | Toast/alert box hibák |
| Elválasztók | Háttérszín váltás VAGY ghost border | 1px solid divider lines |
---
## 5. Adatkezelési útmutató
### Mock adatok (fejlesztési fázis)
Amíg a Supabase táblákat nem töltöd fel, használj mock adatokat:
```typescript
// lib/mock-data.ts
export const mockMatches = [
  { id: '1', home: 'FC Barcelona', away: 'Real Madrid', date: '2025-05-12', time: '21:00', venue: 'Camp Nou' },
  // ...
];
```
### Supabase integrálás (élő adat)
Minden page-hez server component-et preferálj:
```typescript
// app/(app)/news/page.tsx
import { createClient } from '@/lib/supabase/server';
export default async function NewsPage() {
  const supabase = await createClient();
  const { data: news } = await supabase.from('news').select('*').order('created_at', { ascending: false });
  // ...
}
```
---
## 6. Komponens újrafelhasználás
Ezeket a shared komponenseket az első megvalósítás után minden oldalon újra kell használni:
| Komponens | Fájl | Mikor kellhet |
|-----------|------|--------------|
| `<Navbar />` | `components/Navbar.tsx` | Landing page |
| `<NavbarAuth />` | `components/NavbarAuth.tsx` | Minden auth oldal |
| `<AdminSidebar />` | `components/AdminSidebar.tsx` | Minden admin oldal |
| `<ChatbotWidget />` | `components/ChatbotWidget.tsx` | Minden auth oldal |
| `<NoiseGrain />` | `components/NoiseGrain.tsx` | Background textúra |
| Skeleton-ök | `components/skeletons/*.tsx` | Loading state-ek |
---
## 7. Animációs útmutató
### CSS Only (preferált egyszerűbb esetekre)
```css
/* Staggered reveal */
.reveal-item {
  opacity: 0;
  transform: translateY(20px);
  animation: reveal 0.6s ease forwards;
}
.reveal-item:nth-child(2) { animation-delay: 0.1s; }
.reveal-item:nth-child(3) { animation-delay: 0.2s; }
@keyframes reveal {
  to { opacity: 1; transform: translateY(0); }
}
/* Marquee scroll */
@keyframes marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
```
### Framer Motion (komplexebb interakciókhoz)
```typescript
import { motion } from 'framer-motion';
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6, delay: index * 0.1 }}
>
```
---
## 8. Hibakeresési tippek
### "A design generikus néz ki"
→ Ellenőrizd: van-e `Bebas Neue` font betöltve? Van-e `border-radius: 0` override?
### "A háttér nem sötét/eltér"
→ Ellenőrizd a `globals.css`-t: `--bg-base: #1D1A31` be van-e állítva?
### "Az input-ok nem underline stílusúak"
→ shadcn/ui alapból full-border. Override: `border-0 border-b border-[#004D98] rounded-none`
### "Az animációk nem működnek"
→ Ellenőrizd: `@keyframes` definiálva van-e `globals.css`-ben, `animation` property alkalmazva van-e
---
## 9. Iteratív fejlesztési sorrend (iterációk szerint)
A `Plan.md` iterációs tervéhez igazítva:
| Iteráció | Promptok | Cél |
|---------|----------|-----|
| **IT0** | globals.css, layout, Navbar | Design system alap |
| **IT1** | 1, 2, 3 | Guest felület (landing + auth) |
| **IT2** | 4, 5, 6, 7, 8 | Főoldal + tartalom |
| **IT3** | 9, 10, 11, 12, 13 | Játékosok + shop |
| **IT4** | 14, 15, 16, 17 | Közösség + profil |
| **IT5** | 18-24 | Admin panel |
| **IT6** | 25 | Loading states |
---
*Minden kérdésnél, ami a vizuális stílusra vonatkozik, hivatkozz vissza a `skill.txt` és a `claude_code_prompts.md` Globális Design Rendszer szekciójára.*