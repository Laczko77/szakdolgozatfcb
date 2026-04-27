# FC Barcelona Szurkolói Portál — Frontend Backlog

## Scope Summary

Az FC Barcelona szurkolói portál frontend rétege Next.js App Router + TypeScript + Tailwind CSS stack-en. A design filozófia: **"Lebegő elemek végtelen sötét térben"** — folytonos háttér tördelés nélkül, liquid glass kártyák és elemek, pill alakú lebegő navbar, animációk Framer Motion + GSAP ScrollTrigger + CSS kombinációval. Két téma: sötét mód (navy háttér, tompított blaugrana akcentek) és világos mód (vajszínű háttér, telített Barça színek). A landing page kiemelt kreatív szint, a többi oldal tiszta és funkcionális. Mobilon bottom tab bar navigáció, desktopra flip animációk a játékos kártyákon, command palette stílusú globális kereső. Fontok: Bebas Neue (display/heading) + DM Sans (body).

---

## Design Döntések Összefoglalója

| Döntés | Választás |
|--------|-----------|
| Alap téma | Sötét navy háttér, dark/light mode toggle |
| Light mode | Vajszínű háttér (#FAF9F6), akcentek: #154284 (kék), #A50044 (piros), #D4A84B (arany) |
| Dark mode | Sötét navy (#0A0E1A), akcentek: #003366 (kék), #8C0038 (piros), #C4A34D (arany) |
| Fontok | Bebas Neue (display/heading) + DM Sans (body), Google Fonts |
| Vizuális identitás | Liquid glass kártyák, gombok, navbar |
| Háttér | Egyetlen folytonos szín, nincs szekciós tördelés |
| Elemek érzete | Lebegő, árnyékolt, glass hatás |
| Navbar | Pill alakú, középen lebegő "sziget", sticky |
| Mobil navigáció | Bottom tab bar (app-szerű) |
| Desktop kereső | Command palette (Ctrl+K / spotlight) |
| Landing page | WOW szint — animált Camp Nou háttér, scroll-triggered szekciók |
| Többi oldal | Tiszta, funkcionális, liquid glass design system |
| Animációk | Framer Motion + GSAP ScrollTrigger + CSS, max 4-5/oldal |
| Játékos kártyák | Desktop: hover flip animáció, Mobil: direkt navigáció |
| Jegyrendszer | SVG sematikus stadion térkép kattintható szektorokkal |
| Admin panel | Sidebar nav, shadcn/ui komponensek, funkcionális fókusz |
| Rich text editor | Tiptap (admin cikkszerkesztő) |
| Form kezelés | react-hook-form + zod |
| Charting | Recharts (admin analitika) |

---

## Animációs & Könyvtár Stack

| Könyvtár | Verzió | Felhasználás | Bundle hatás |
|----------|--------|--------------|--------------|
| **Framer Motion** | ^11.x | React komponens animációk: `whileInView` (szekciók fade-in/slide-up), `AnimatePresence` (szóváltakozás, modal/drawer mount/unmount), stagger animációk, reakció picker popup, polling új elemek fade-in, layout animációk | ~32KB gzip |
| **GSAP + ScrollTrigger** | ^3.x | Kizárólag a landing page játékos carousel: pinned scroll szekció, crossfade háttérkép váltás görgetésre, scrub-alapú timeline. Egyetlen komponensben él (`PlayerCarousel.tsx`) | ~28KB gzip |
| **CSS transitions/animations** | natív | Mindennapi mikro-interakciók: hover scale, glass glow, flip kártya 3D transform, gradient transition (FC Barcelona felirat), navbar scroll opacity, skeleton pulse | 0KB |
| **Tailwind animate-*** | beépített | Skeleton loader pulse, spinner, bounce, ping | 0KB |
| **sonner** (opcionális) | ^2.x | Glass toast értesítések — vagy saját Framer Motion implementáció helyettesítheti | ~5KB gzip |
| **react-hook-form** | ^7.x | Form kezelés: checkout, regisztráció, admin CRUD formok | ~9KB gzip |
| **zod** | ^3.x | Form validáció (react-hook-form + zod resolver integráció) | ~14KB gzip |
| **Tiptap** | ^2.x | Rich text editor a cikkek admin szerkesztéséhez (headings, bold, italic, listák, linkek) | ~30KB gzip |
| **shadcn/ui** | latest | Admin panel UI komponensek: Table, Form, Dialog, Select, Badge stb. (NEM a public oldalakhoz) | tree-shaken |
| **Recharts** | ^2.x | Admin analitika dashboard grafikonok (bar chart, line chart) | ~50KB gzip |

### Munkamegosztás elve

- **Ha CSS-sel megoldható → CSS.** Hover effektek, transition-ök, transform-ok, egyszerű keyframe animációk.
- **Ha React életciklushoz kötött → Framer Motion.** Megjelenés/eltűnés, viewport-ba érés, layout váltás, gesztusok.
- **Ha scroll-pozícióhoz kötött komplex timeline → GSAP ScrollTrigger.** Csak a landing page carousel.

---

## Backlog Progress

| Metric | Value |
|--------|-------|
| Total tasks | 86 |
| Completed tasks | 65 |
| Remaining tasks | 21 |
| Completion | 76% |

---

## Iterations

---

### Iteration F1 — Design System & Téma Alapok

**Status:** DONE

**Goal:** A teljes portál vizuális alaprendszerének felépítése: színpaletták (dark/light), CSS custom properties, liquid glass utility classok, tipográfia, árnyékolás, spacing, és a theme toggle logika — hogy minden további iteráció konzisztens vizuális nyelvet használjon.

**Backend dependency:** Iteration 1 (projekt alapok)

**Tasks:**

- [x] F1.1 Szín paletta definiálása CSS custom properties-ként (`src/styles/themes.css`):
  - **Dark mode:** háttér `--bg-primary: #0A0E1A`, `--bg-secondary: #111827`, glass: `--glass-bg: rgba(255,255,255,0.05)`, `--glass-border: rgba(255,255,255,0.1)`, akcentek: `--accent-blue: #003366`, `--accent-red: #8C0038`, `--accent-gold: #C4A34D`, szöveg: `--text-primary: #F9FAFB`, `--text-secondary: #9CA3AF`
  - **Light mode:** háttér `--bg-primary: #FAF9F6`, `--bg-secondary: #F0EBE3`, glass: `--glass-bg: rgba(0,0,0,0.03)`, `--glass-border: rgba(0,0,0,0.08)`, akcentek: `--accent-blue: #154284`, `--accent-red: #A50044`, `--accent-gold: #D4A84B`, szöveg: `--text-primary: #1A1A2E`, `--text-secondary: #6B7280`
- [x] F1.2 Tailwind config kiterjesztése (`tailwind.config.ts`): a CSS custom property-k beregisztrálása Tailwind utility classokká (pl. `bg-primary`, `text-accent-gold`, `glass`, stb.), `darkMode: 'class'` konfiguráció
- [x] F1.3 Liquid glass utility rendszer létrehozása:
  - `.glass-card` — `backdrop-blur-md`, semi-transparent bg, finom border, shadow
  - `.glass-card-hover` — hover-re fényesedő border, enyhe scale(1.02)
  - `.glass-button-primary` — arany/gradient szegély, glass fill
  - `.glass-button-secondary` — subtilis glass háttér
  - `.glass-nav` — navbar-specifikus blur és áttetszőség
  - Minden utility-nak legyen dark és light variánsa
- [x] F1.4 Tipográfia beállítása: display font **Bebas Neue** (heading-ek, kiemelt feliratok, játékos számok) + body font **DM Sans** (folyószöveg, UI elemek, gombok), mindkettő Google Fonts-ról `next/font/google`-lel betöltve. Font méret skála definiálása (heading-ek, body, small)
- [x] F1.5 Árnyékolási rendszer (`--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-glow`) — a lebegő érzet kulcsa, minden glass elemen konzisztens árnyékok, dark/light módban eltérő intenzitással
- [x] F1.6 Spacing és layout tokenek: max content width (`--max-width-content: 1280px`), section gap, card gap, padding skála
- [x] F1.7 Theme toggle implementálása: `ThemeProvider` context (React Context), `useTheme()` hook, preferencia mentése `localStorage`-ba, alapértelmezés `prefers-color-scheme` media query-ből, `data-theme` attribútum a `<html>` elemen
- [x] F1.8 Globális layout shell (`src/app/layout.tsx`): folytonos háttérszín beállítása a `<body>`-n (nincs szekciós tördelés), ThemeProvider wrapping, alapvető meta tagek
- [x] F1.9 Animációs könyvtárak telepítése és konfigurálása:
  - `framer-motion` (^11.x) — import tesztelése, `LazyMotion` provider beállítása a bundle optimalizáláshoz
  - `gsap` + `@gsap/react` (^3.x) — csak a landing page carousel-hez, `gsap.registerPlugin(ScrollTrigger)` konfigurálás
  - `prefers-reduced-motion` globális hook (`useReducedMotion`) létrehozása — ha a user csökkentett mozgást preferál, minden animáció kikapcsol
- [x] F1.10 Loading képernyő komponens (`src/components/common/LoadingScreen.tsx`):
  - Teljes képernyős overlay a Barça címer SVG-jével középen
  - A címer pulzáló opacity animációval "lélegzik" (CSS `@keyframes pulse` vagy Framer Motion)
  - Használat: kezdeti alkalmazás betöltésnél (Supabase auth session ellenőrzés ideje alatt), és opcionálisan lassabb adatlekérdezéseknél
  - A kártyák/listák szintjén marad a skeleton shimmer — a loading screen csak a teljes oldal szintű állapotokra
- [x] F1.11 Glass toast értesítés rendszer (`src/components/common/Toast.tsx`):
  - Globális toast provider (pl. `sonner` library vagy saját Framer Motion implementáció)
  - Glass stílusú toast kártyák: `backdrop-blur`, semi-transparent háttér, finom szegély — illeszkedik a liquid glass design system-hez
  - Típus variánsok: siker (zöld akcenttel), hiba (piros), info (kék), pont szerzés (arany — "+50 pont!" jellegű)
  - Animáció: slide-in felülről vagy alulról, 3 mp megjelenés, slide-out
  - Dark/light mode támogatás
  - Felhasználási helyek (a későbbi iterációkban bekötjük): kosárba tétel, rendelés leadás, szavazat leadás, pont szerzés, kupon beváltás, hibaüzenetek
- [x] F1.12 Utility könyvtárak telepítése és konfigurálása:
  - `shadcn/ui` inicializálás (`npx shadcn-ui@latest init`), komponensek: Table, Form, Dialog, Select, Badge — kizárólag az admin panelhez
  - `react-hook-form` + `@hookform/resolvers` + `zod` — form kezelés és validáció
  - `Tiptap` (`@tiptap/react`, `@tiptap/starter-kit`) — rich text editor az admin cikkszerkesztőhöz
  - `Recharts` — admin analitika dashboard grafikonok

**Acceptance Criteria:**

- A dark és light mode közötti váltás azonnal, villanás nélkül működik
- Minden glass utility class helyesen jelenik meg mindkét témában
- A tipográfia (Bebas Neue + DM Sans) konzisztens és olvasható mindkét módban (WCAG AA kontraszt)
- A háttérszín teljesen folytonos, nincs szekciós tördelés
- A theme toggle preferencia megmarad oldalfrissítés után is
- A loading screen a Barça címerrel megjelenik alkalmazás betöltésekor
- A toast értesítések glass stílusban jelennek meg és eltűnnek, mindkét témában konzisztensek
- A shadcn/ui, react-hook-form, zod, Tiptap, Recharts könyvtárak telepítve és importálhatók

**Dependencies:** Backend Iteration 1

---

### Iteration F2 — Layout Shell: Navbar & Bottom Tab Bar

**Status:** DONE

**Goal:** A portál állandó navigációs elemeinek felépítése: desktop pill navbar és mobil bottom tab bar, theme toggle beépítése a navbar-ba, és a responsive váltás logikája.

**Backend dependency:** Iteration 2 (auth szükséges a profil avatar és bejelentkezés gombhoz)

**Tasks:**

- [x] F2.1 Desktop pill navbar komponens (`src/components/layout/Navbar.tsx`):
  - Pill (kapszula) forma: `rounded-full`, nem ér a képernyő széléig, középen lebeg
  - Liquid glass háttér: `backdrop-blur`, semi-transparent, finom szegély
  - Sticky pozíció: `position: sticky; top: 1rem;` (kis gap a tetejétől a lebegő érzet miatt)
  - Scroll-viselkedés: az oldal tetején szinte teljesen átlátszó, görgetéskor a glass háttér "materializálódik" (opacity animáció scroll position alapján)
  - Tartalom: bal — logó/brand, közép — fő menüpontok (Hírek, Shop, Jegyek, Játékosok, Közösség), jobb — kereső ikon, theme toggle (nap/hold), profil avatar (bejelentkezve) vagy "Belépés" gomb (kijelentkezve)
- [x] F2.2 Mobil bottom tab bar komponens (`src/components/layout/BottomTabBar.tsx`):
  - Fix az oldal alján, 5 tab: Főoldal, Shop, Jegyek, Közösség, Profil
  - Ikonok (Lucide icons), aktív tab kiemelve akcentszínnel
  - Glass háttér, finom felső szegély
  - Safe area padding (notch-os telefonoknál)
- [x] F2.3 Mobil felső sáv: egyszerűsített pill navbar — logó (bal), kereső ikon + theme toggle (jobb), a navigáció a bottom tab-ban él
- [x] F2.4 Responsive váltás logika: `md:` breakpoint felett desktop navbar (bottom tab rejtve), alatta bottom tab bar (desktop menüpontok rejtve). `useMediaQuery` hook vagy CSS media query
- [x] F2.5 Aktív oldal jelölése: a navbar menüpontban és a bottom tab-ban is vizuálisan kiemelve az aktuális route (Next.js `usePathname()`)

**Acceptance Criteria:**

- Desktop: a pill navbar középen lebeg, scroll-re a glass háttér megjelenik
- Mobil: a bottom tab bar fix, a felső sáv kompakt, a navigáció természetes
- A theme toggle mindkét platformon elérhető és működik
- Az aktív oldal egyértelműen jelölt mindkét navigációban
- A navbar nem takarja el a tartalmat (megfelelő padding-top az oldal tartalmán)

**Dependencies:** Iteration F1, Backend Iteration 2

---

### Iteration F3 — Landing Page

**Status:** DONE

**Goal:** A portál "belépő élménye" — egy kreatív, animált landing page ami WOW érzetet ad: animált Camp Nou háttér, scroll-triggered szekciók, játékos carousel, és csatlakozásra buzdító elemek.

**Backend dependency:** Nincs (statikus tartalom, a játékos carousel később bekötődik az API-hoz)

**Tasks:**

- [x] F3.1 Hero szekció:
  - Teljes viewport-magasságú szekció (`min-h-screen`)
  - Háttér: AI-animált Camp Nou videó (`<video autoPlay muted loop playsInline>`) sötét overlay-jel. Mobilon fallback statikus képre (`<picture>` / media query, a videó nem töltődik)
  - Headline: *"Més que un club"* megjelenik (fade-in vagy SVG path animáció), alatta gépelő effekttel a magyar szöveg: *"Több, mint egy klub. Több, mint egy portál."*
  - CTA gomb: *"Fedezd fel"* / *"Csatlakozz"* — liquid glass pill gomb, pulzáló arany szegéllyel
  - Scroll indicator ikon az alján (lefelé mutató nyíl, enyhe bounce animáció)
- [x] F3.2 About szekció:
  - Rövid leírás a portálról (2-3 mondat), scroll-triggered fade-in-nel jelenik meg
  - 2-3 kiemelt kulcsszó (pl. *"közösség"*, *"szenvedély"*, *"Barça"*) késleltetett animációval: a szöveg megjelenik, majd ~300ms késleltetéssel a kiemelt szavak arany glow-val "felvillannak" (Framer Motion `staggerChildren`)
- [x] F3.3 Játékos carousel szekció (**GSAP ScrollTrigger**):
  - 3-4 játékos teljes képernyős pinned scroll carousel — GSAP ScrollTrigger `pin` + `scrub` használatával
  - Minden "slide" egy teljes viewport-magasságú szekció: háttérben a játékos arca (ráközelítve, blur-ölve és sötétítve), előtérben egy glass kártya a játékos nevével, mezszámával, pozíciójával és 3-4 fő statisztikával, mellette a játékos kisebb teljes alakos képe
  - Görgetésre a szekció pin-elődik (megáll), a háttérkép crossfade-del átvált a következő játékosra, a kártya tartalma cserélődik (GSAP timeline + scrub)
  - A teljes GSAP logika egyetlen komponensben él (`src/components/landing/PlayerCarousel.tsx`)
  - Hardkódolt adatok az MVP-ben (később API-ból töltődik)
  - Mobilon: egyszerűsített verzió — vertikális stack a játékos kártyákkal, GSAP pin nélkül (mobil `ScrollTrigger.isTouch` feltétellel)
- [x] F3.4 Csatlakozási CTA szekció:
  - Egy mondat (pl. *"Légy része a [közösségnek]"*) ahol egy szó 2-3 másodpercenként cserélődik szinonimákra (közösségnek → szenvedélynek → történelemnek → családnak), fade-out/slide-up animációval (`AnimatePresence`)
  - Alatta regisztrációs CTA gomb
- [x] F3.5 FC Barcelona felirat:
  - Nagy, merész display font felirat: *"FC BARCELONA"*
  - Alapállapot: blaugrana kék szín
  - Hover-re: gradient átmenet kékből pirosba (`background-clip: text`, `background-position` animáció transition-nel)
- [x] F3.6 Footer komponens:
  - Egyszerű footer: portál neve, copyright, 3-4 link (Impresszum, Adatvédelem, Kapcsolat), közösségi média ikonok
  - Sötét tónus, subtilis glass vagy solid háttér
  - Responsive: mobilon stack-elt elrendezés
- [x] F3.7 Performance optimalizáció:
  - Videó lazy loading (csak viewport-ba érve tölt)
  - Képek `next/image`-gel optimalizálva
  - Framer Motion animációk `whileInView`-val (nem tölt minden animáció egyszerre)
  - Lighthouse performance audit: minimum 80-as score mobilon

**Acceptance Criteria:**

- A landing page desktop-on és mobilon egyaránt lenyűgöző vizuális élményt nyújt
- A hero szekció videó háttere desktopra tölt, mobilon fallback statikus képre
- A scroll animációk smooth-ok, nem akadnak (60fps)
- A játékos carousel görgetésre természetesen vált játékosok között
- A szóváltakozó CTA szekció folyamatosan és elegánsan cserélődik
- Az FC Barcelona felirat hover gradient animáció működik
- A footer responsive és tartalmazza az alapvető linkeket
- Lighthouse mobile score >= 80

**Dependencies:** Iteration F1, F2

---

### Iteration F4 — Autentikáció UI

**Status:** DONE

**Goal:** A bejelentkezési és regisztrációs felület megvalósítása: login/regisztráció form, Google OAuth gomb, és az auth állapot kezelése a kliens oldalon.

**Backend dependency:** Iteration 2 (Supabase Auth)

**Tasks:**

- [x] F4.1 Login oldal (`src/app/login/page.tsx`):
  - Középre igazított glass kártya a formmal
  - Email + jelszó mezők, "Belépés" gomb
  - Google OAuth gomb (Google logóval, "Belépés Google-lel")
  - "Nincs fiókod? Regisztrálj" link a regisztrációs oldalra
  - Hibaüzenetek (hibás jelszó, nem létező email) megjelenítése
  - Háttér: a landing page-vel konzisztens sötét háttér
- [x] F4.2 Regisztrációs oldal (`src/app/register/page.tsx`):
  - Hasonló elrendezés mint a login, email + jelszó + jelszó megerősítés
  - Google OAuth gomb
  - "Van már fiókod? Jelentkezz be" link
  - Sikeres regisztráció után tájékoztató a megerősítő emailről
- [x] F4.3 Auth context és session kezelés (`src/providers/AuthProvider.tsx`):
  - Supabase `onAuthStateChange` listener
  - `useAuth()` hook: `user`, `profile`, `isAdmin`, `isLoading`, `signOut()`
  - Session automatikus frissítése
- [x] F4.4 Védett route-ok kliens oldali kezelése: ha nem bejelentkezett user próbál elérni védett oldalt, redirect a login-ra a visszatérési URL megőrzésével
- [x] F4.5 Navbar integrálás: bejelentkezve avatar + dropdown menü (Profil, Kijelentkezés, ha admin: Admin Panel), kijelentkezve "Belépés" gomb

**Acceptance Criteria:**

- Email/jelszó bejelentkezés és regisztráció működik a UI-ról
- Google OAuth login egy kattintással működik
- A navbar dinamikusan tükrözi az auth állapotot
- Hibás bejelentkezés érthető hibaüzenetet ad
- Sikeres bejelentkezés után a user a dashboard-ra (vagy visszatérési URL-re) navigálódik
- Admin user látja az "Admin Panel" opciót a dropdown-ban

**Dependencies:** Iteration F2, Backend Iteration 2

---

### Iteration F5 — Dashboard (Bejelentkezett User Főoldal)

**Status:** DONE

**Goal:** A bejelentkezett felhasználó "napi központja" — widget-alapú dashboard ami gyors hozzáférést biztosít a fő funkciókhoz.

**Backend dependency:** Iteration 3-7 (a widgetek az egyes backend modulokra építenek, de skeleton/placeholder állapottal korábban is elkezdhető)

**Tasks:**

- [x] F5.1 Dashboard layout (`src/app/dashboard/page.tsx`):
  - Desktop: 3 oszlopos CSS Grid, a widgetek különböző méretűek (span-1, span-2)
  - Mobil: 1 oszlopos stack
  - Üdvözlő szöveg a felhasználó becenéssel ("Szia, [username]! 👋")
- [x] F5.2 "Következő meccs" widget (kiemelt, span-2 desktopra):
  - Két csapat neve/logója, dátum, helyszín
  - Visszaszámláló (nap:óra:perc:mp)
  - "Jegyvásárlás" CTA gomb
  - Ha nincs közelgő meccs: "Nincs közelgő meccs" üzenet
- [x] F5.3 "Legfrissebb hírek" widget:
  - 3 legújabb cikk mini kártya (kép, cím, dátum)
  - "Összes hír" link
- [x] F5.4 "Pontegyenlegem" widget:
  - Aktuális pontszám nagy számmal
  - Utolsó tranzakció rövid leírása
  - "Pont-áruház" link
- [x] F5.5 "Rendeléseim" widget:
  - Aktív rendelések száma és legutóbbi rendelés státusza (badge-gel: feldolgozás/feladva/kézbesítve)
  - "Rendeléseim" link a profilra
- [x] F5.6 Skeleton loading állapot: minden widgetnek legyen loading skeleton-ja (animált placeholder blokkok) amíg az adat töltődik

**Acceptance Criteria:**

- A dashboard responsive: desktopra grid, mobilon stack
- Minden widget az élő adatokat mutatja a backend-ből
- A widgetek loading állapotban skeleton-t mutatnak, nem üres helyet
- A CTA linkek a megfelelő oldalakra navigálnak
- A visszaszámláló real-time frissül

**Dependencies:** Iteration F4, Backend Iterations 3-7 (részenként bekötődik)

---

### Iteration F6 — Hírrendszer UI

**Status:** DONE

**Goal:** A hírportál frontend felülete: cikklista kiemelt hero cikkel, kategória szűrés, és cikk olvasó nézet.

**Backend dependency:** Iteration 3 (CMS backend)

**Tasks:**

- [x] F6.1 Hírek listaoldal (`src/app/hirek/page.tsx`):
  - Kiemelt hero cikk: nagy, széles glass kártya felül — a legújabb cikk képe, címe gradient overlay-jel a kép alján, dátum és kategória badge
  - Alatta a többi cikk grid-ben: desktop 3 oszlop, tablet 2, mobil 1
  - Cikk kártyák: glass stílus, kép fent, cím, rövid kivonat (első 100 karakter), dátum, kategória pill badge
  - Hover: enyhe scale(1.02) + glass szegély fényesedés
- [x] F6.2 Kategória szűrő:
  - Horizontálisan görgethető pill gombok a lista felett: "Mind", "Átigazolások", "Meccsösszefoglalók", "Interjúk", "Hírek"
  - Aktív pill arany kiemelés
  - Kattintásra szűrt lista, URL query paraméterrel (`?category=transfers`)
- [x] F6.3 Cikk részletes oldal (`src/app/hirek/[id]/page.tsx`):
  - Széles hero kép a tetején (teljes szélességű)
  - Cím: nagy, merész, alatta dátum + kategória + szerző
  - Tartalom: jól olvasható szélességben (max 720px, középre igazítva), szép tipográfia
  - "Vissza a hírekhez" navigáció
- [x] F6.4 Lapozás: "Több cikk betöltése" gomb vagy infinite scroll a lista alján
- [x] F6.5 Üres állapot kezelése: ha nincs cikk az adott kategóriában, barátságos üzenet illusztrációval

**Acceptance Criteria:**

- A híroldal betöltődik a cikkek listájával, a legújabb kiemelve hero-ként
- A kategória szűrés azonnal szűri a listát
- Egy cikk megnyitása szép olvasó nézetben jeleníti meg a tartalmat
- Mobilon a grid 1 oszlopos, a kártyák jól olvashatók
- Lapozás/infinite scroll működik sok cikk esetén

**Dependencies:** Iteration F1, F2, Backend Iteration 3

---

### Iteration F7 — Játékos Adatbázis UI

**Status:** TODO

**Goal:** A játékos böngésző felülete: csapatkeretlista pozíció szerinti csoportosítással, játékos kártyák flip animációval desktopra, és részletes játékos profil oldal statisztika vizualizációkkal.

**Backend dependency:** Iteration 4 (API-Football integráció)

**Tasks:**

- [ ] F7.1 Játékos lista oldal (`src/app/jatekosok/page.tsx`):
  - Pozíció szerinti csoportosítás (szekciók): Kapusok, Védők, Középpályások, Támadók
  - Szekció fejlécek a pozíció nevével
  - Grid elrendezés szekción belül: desktop 4 oszlop, tablet 3, mobil 2
- [ ] F7.2 Játékos kártya komponens (`src/components/players/PlayerCard.tsx`):
  - **Elülső oldal:** játékos képe, neve, mezszáma (nagy számmal), pozíció badge
  - **Hátulsó oldal (csak desktop, `@media (hover: hover)`):** 3-4 fő statisztika (gólok, gólpasszok, meccsek, sárga lapok) + "Profil megtekintése" gomb
  - **Desktop hover:** kártya flip animáció (CSS `transform: rotateY(180deg)` + `backface-visibility: hidden`, transition 0.6s)
  - **Mobil:** nincs flip, a kártya mindig az elülső oldalt mutatja + alul 2-3 fő stat szám, tap → profil oldal
- [ ] F7.3 Pozíció szűrő: pill gombok a lista felett (Mind, Kapus, Védő, Középpályás, Támadó) — hasonló a hír kategória szűrőhöz
- [ ] F7.4 Játékos profil oldal (`src/app/jatekosok/[id]/page.tsx`):
  - Hero szekció: játékos képe (bal), név + mezszám + pozíció (jobb), glass kártya háttér
  - Statisztikák vizuális megjelenítéssel: progress bar-ok vagy Recharts sugárdiagram (radar chart) a teljesítményhez (gólok, gólpasszok, meccsek, sárga/piros lapok)
  - Bio szekció: az admin által írt szöveges leírás
  - "Vissza a kerethez" navigáció
- [ ] F7.5 Landing page carousel bekötése: az F3.3-ban hardkódolt adatok lecserélése élő API adatokra (top 3-4 játékos automatikus kiválasztása)

**Acceptance Criteria:**

- A játékos lista pozíció szerint csoportosítva jelenik meg
- Desktopra a hover flip animáció smooth-an működik
- Mobilon tap → közvetlen navigáció a profil oldalra
- A játékos profil oldal vizuálisan mutatja a statisztikákat (nem csak számok)
- A pozíció szűrő helyesen szűri a listát
- A landing page carousel élő adatokkal töltődik

**Dependencies:** Iteration F1, F2, F3 (carousel bekötés), Backend Iteration 4

---

### Iteration F8 — Webshop UI

**Status:** DONE

**Goal:** A webshop teljes vásárlási folyamata: terméklista, termékoldal variánsválasztóval, slide-in kosár, checkout, wishlist, és értékelések.

**Backend dependency:** Iteration 5 (Webshop backend)

**Tasks:**

- [x] F8.1 Terméklista oldal (`src/app/shop/page.tsx`):
  - Grid: desktop 3-4 oszlop, tablet 2, mobil 1-2
  - Termékkártya: glass kártya, termék kép, név, ár, átlagos értékelés (csillagok), wishlist szív ikon (jobb felső sarok)
  - Hover: scale(1.02) + glass szegély glow + "Kosárba" gomb megjelenik
  - Kategória szűrő pill gombok (ha releváns)
- [x] F8.2 Termék részletes oldal (`src/app/shop/[id]/page.tsx`):
  - Bal oldal: termékkép (ha több kép: galléria, thumbnail-ek alul)
  - Jobb oldal: terméknév, ár, leírás, méretválasztó (pill gombok), színválasztó (színes körök), készletjelző ("12 db raktáron"), mennyiségválasztó (+/- gombok), "Kosárba" CTA gomb (arany glass), wishlist szív gomb
  - Alul: értékelések szekció
- [x] F8.3 Variáns logika: méret + szín kiválasztásakor a készlet az adott variánshoz frissül, ha nincs készleten az adott variáns: a pill/kör szürkére vált és nem kattintható
- [x] F8.4 Kosár drawer (`src/components/shop/CartDrawer.tsx`):
  - Desktop: jobb oldalról kicsúszó panel (slide-in drawer), 400px széles
  - Mobil: fullscreen overlay
  - Tartalom: tételek listája (kép, név, variáns, mennyiség +/- gombok, törlés, ár), összesítő (részösszeg, összesen), "Pénztár" gomb
  - Üres kosár állapot: barátságos üzenet + "Shop böngészése" link
  - Kosár ikon a navbar-ban badge-gel (tételek száma)
- [x] F8.5 Checkout oldal (`src/app/shop/checkout/page.tsx`):
  - 2 lépéses flow:
    - 1. lépés: Szállítási adatok form (név, cím, telefonszám — szimulált, nincs szállítási költség) + opcionális kuponkód mező
    - 2. lépés: Rendelés összegző (tételek, árak, kupon kedvezmény ha van, végösszeg) + "Megrendelés (demo)" gomb
  - Sikeres rendelés: megerősítő oldal konfettivel vagy checkmark animációval
- [x] F8.6 Wishlist szív animáció: kattintásra a szív "megtelik" (üres körvonal → teli piros, scale animáció mint Instagram like). A wishlist oldal a profil alatt érhető el
- [x] F8.7 Értékelés rendszer:
  - Termékoldal alján: értékelések listája (avatar, username, 5 csillag, szöveg, dátum)
  - "Értékelés írása" gomb → glass modal: csillag választó (kattintható 1-5) + szöveges mező + "Küldés" gomb
  - Ha a user már értékelt: "Már értékelted" üzenet
- [x] F8.8 Rendelés lemondás: a profil rendelések listájában "Lemondás" gomb, de csak ha a státusz nem "feladva" — a gomb megerősítő modal-lal védett

**Acceptance Criteria:**

- A termékek böngészhetők, szűrhetők, a kártyák vizuálisan szépek
- A variánsválasztó helyesen mutatja a készletet
- A kosár drawer természetesen nyílik/csukódik, a tételek kezelhetők
- A checkout 2 lépésben végigvezeti a felhasználót
- Kuponkód alkalmazása működik a checkout-ban
- A wishlist szív animáció smooth és vizuálisan kellemes
- Az értékelés form működik, az értékelések megjelennek a termékoldalakon
- Mobilon minden elem jól kezelhető (gombok elég nagyok, formok kitölthetők)

**Dependencies:** Iteration F1, F2, F4, Backend Iteration 5

---

### Iteration F9 — Jegyrendszer UI

**Status:** TODO

**Goal:** A jegyvásárlási felület: meccsek listája, SVG stadion szektor térkép, jegyválasztó és demo vásárlás.

**Backend dependency:** Iteration 6 (Jegyrendszer backend)

**Tasks:**

- [ ] F9.1 Meccsek listaoldal (`src/app/jegyek/page.tsx`):
  - Időrendi lista kártyákban: két csapat neve/logója, dátum, helyszín
  - Státusz badge-ek: "Jegyvásárlás elérhető" (zöld), "Hamarosan" (sárga), "Lejátszott" (szürke)
  - Kattintás → meccs részletek / jegyvásárlás oldal
- [ ] F9.2 SVG stadion szektor térkép (`src/components/tickets/StadiumMap.tsx`):
  - Sematikus stadion forma SVG-ben: ovális/téglalap alakú stadion körvonal, 6-8 szektor blokk elrendezve a stadion formán
  - Minden szektor kattintható, a szektorra hover-nél tooltip a nevével, szabad helyek számával és jegyárral
  - Színkódolás: elérhető szektor → akcentszín, betelt szektor → szürke/inaktív, kiválasztott szektor → arany kiemelés
  - Mobilon a térkép zoom-olható/görgethető legyen (vagy alatta lista alternatívaként)
- [ ] F9.3 Jegyválasztó panel (a térkép mellett vagy alatt):
  - Kiválasztott szektor neve, szabad helyek száma, és jegyár/db
  - Mennyiség választó (1-4, max limit jelezve)
  - Ár összesítő (jegyár × mennyiség)
  - "Jegyvásárlás (demo)" CTA gomb
  - Opcionális kuponkód mező
- [ ] F9.4 Sikeres vásárlás megerősítés: a megvásárolt jegyek részletei (szektor, székszámok, dátum), "jegy-kártya" megjelenítés vizuálisan (mint egy digitális jegy)
- [ ] F9.5 Mobil alternatíva: ha a stadion SVG mobilon túl kicsi, alatta egy lista/grid a szektorokkal (kártyák: szektor neve, szabad/összes hely, állapot pill), a térkép opcionális

**Acceptance Criteria:**

- A meccslista betöltődik és vizuálisan tiszta
- A stadion SVG térkép kattinthatóan működik, a szektorok reagálnak
- Betelt szektor nem választható ki
- A jegyválasztó panel helyesen számítja az árat és érvényesíti a limitet (max 4)
- Sikeres vásárlás megerősítő képernyővel zárul
- Mobilon használható (akár térkép zoom, akár lista fallback)

**Dependencies:** Iteration F1, F2, Backend Iteration 6

---

### Iteration F10 — Profil Oldal & Globális Kereső UI

**Status:** TODO

**Goal:** A felhasználói profiloldal (adatkezelés, vásárlási előzmények, pont-történet) és a command palette stílusú globális kereső megvalósítása.

**Backend dependency:** Iteration 7 (Profil & kereső backend)

**Tasks:**

- [ ] F10.1 Profil oldal layout (`src/app/profil/page.tsx`):
  - Felső szekció: profilkép (körkivágás, kattintásra módosítható — file input + crop preview), becenév (inline szerkeszthető), pontegyenleg nagy számmal
  - Alatta tab navigáció: "Rendeléseim", "Jegyeim", "Kuponjaim", "Pontjaim", "Beállítások"
  - Desktop: horizontális tabok
  - Mobil: horizontálisan görgethető pill gombok
- [ ] F10.2 "Rendeléseim" tab:
  - Rendelések timeline/lista: dátum, tételek összegzése, összeg, státusz badge (feldolgozás → feladva → kézbesítve, színkódolt)
  - Lemondás gomb ahol elérhető (megerősítő modal-lal)
- [ ] F10.3 "Jegyeim" tab:
  - Megvásárolt jegyek kártyái: meccs adatai, szektor, székszám(ok), dátum
  - Közelgő meccs jegyei kiemelve, lejátszott meccsek halványabban
- [ ] F10.4 "Pontjaim" tab:
  - Aktuális egyenleg kiemelten
  - Tranzakció-történet lista: dátum, összeg (+50 / -200), ok (szavazás nyeremény / kupon beváltás)
- [ ] F10.5 "Beállítások" tab:
  - Becenév módosítás form
  - Jelszóváltoztatás form (jelenlegi jelszó, új jelszó, megerősítés)
  - Profilkép feltöltés (drag & drop vagy kattintás)
- [ ] F10.6 Command palette kereső (`src/components/search/CommandPalette.tsx`):
  - Trigger: Ctrl+K (desktop), kereső ikon kattintás (mindkét platform)
  - Megnyitva: teljes képernyő overlay sötét backdrop-pal, középen glass kártya a keresőmezővel
  - Gépelés közben élő eredmények (debounced, 300ms): típus szerint csoportosítva (Hírek, Termékek, Játékosok, Posztok), minden eredmény mini kártya (kép/ikon + cím + típus badge)
  - Kattintás/Enter → navigáció a kiválasztott elemre, a palette bezárul
  - Escape / backdrop kattintás → bezárul
  - Billentyűzet navigáció: fel/le nyíl a találatok között, Enter kiválasztás

**Acceptance Criteria:**

- A profil oldal minden tabja betölti a releváns adatokat
- Profilkép és becenév módosítható, a változás azonnal tükröződik a navbar-ban
- Jelszóváltoztatás működik hibakezeléssel
- A command palette Ctrl+K-ra megnyílik, gépelésre élő eredményeket mutat
- A keresési eredmények kattintásra a megfelelő oldalra navigálnak
- Mobilon a kereső overlay fullscreen, billentyűzet kitakarásakor is használható

**Dependencies:** Iteration F1, F2, F4, Backend Iteration 7

---

### Iteration F11 — Közösségi Feed UI

**Status:** DONE

**Goal:** A közösségi feed felülete: posztok listája, kommentek, emoji reakciók, és 3 másodperces polling az új tartalmakért.

**Backend dependency:** Iteration 8 (Közösségi feed backend)

**Tasks:**

- [x] F11.1 Feed oldal layout (`src/app/kozosseg/page.tsx`):
  - Egyoszlopos, középre igazított layout (max 600px, mint Twitter)
  - Posztok glass kártyákban: admin avatar + név, időbélyeg, szöveges tartalom, opcionális kép, reakció sáv, komment szekció
- [x] F11.2 Reakció rendszer (`src/components/social/ReactionBar.tsx`):
  - Reakció összegző az elem alatt (emoji + szám párok)
  - Kattintásra reakció picker "felbuggyan" (5-6 emoji opció)
  - Saját reakció kiemelve, újra kattintásra visszavonódik, más emoji-ra kattintva cserélődik
  - Smooth animáció a megjelenésnél (scale-in)
- [x] F11.3 Komment szekció (`src/components/social/CommentSection.tsx`):
  - Kommentek alapból összecsukva (pl. "12 komment" link → kinyit), optimista frissítés
  - Kinyitva: kommentek népszerűségi sorrendben (legtöbb reakció elöl)
  - Komment kártya: avatar, username, szöveg, időbélyeg, reakció sáv (kisebb méretben), törlés gomb (saját kommenteken)
  - Komment írás: input mező a szekció alján, "Küldés" gomb
- [x] F11.4 Polling mechanizmus:
  - 3 másodperces `setInterval` a `since` paraméterrel (utolsó lekérdezés timestamp-je), tab-visibility aware
  - Új posztok/kommentek/reakciók smooth-an jelennek meg (fade-in animáció, a meglévők NEM ugrálnak)
  - A polling csak akkor aktív amikor az oldal fókuszban van (`document.visibilityState`)
- [x] F11.5 Poszt kép megjelenítés: kattintásra lightbox (teljes képernyős kép nézet overlay-ben, Escape/X/backdrop dismiss)

**Acceptance Criteria:**

- A feed betöltődik a posztokkal, a legújabb felül
- A reakciók hozzáadása/cseréje/visszavonása smooth animációval működik
- Kommentek kinyithatók/összecsukhatók, népszerűségi sorrendben jelennek meg
- A 3 mp-es polling új tartalmat hoz be a feed ugrása nélkül
- Saját komment törölhető
- Mobil és desktop egyaránt jól működik

**Dependencies:** Iteration F1, F2, F4, Backend Iteration 8

---

### Iteration F12 — Szavazórendszer & Pontrendszer UI

**Status:** DONE

**Goal:** A szavazófelület: aktív szavazások listája, szavazat leadás, eredmények megjelenítése, és a pontrendszer integrálása a profil oldallal.

**Backend dependency:** Iteration 9 (Szavazórendszer backend)

**Tasks:**

- [x] F12.1 Szavazások oldal (`src/app/szavazasok/page.tsx`):
  - Két szekció: "Aktív szavazások" és "Lezárt szavazások"
  - Szavazás kártya: kérdés, kapcsolódó meccs (ha van), szavazat-szám, státusz badge
- [x] F12.2 Szavazat leadás UI:
  - Kérdés kiemelten, opciók pill/rádió gombokként
  - "Szavazok" CTA gomb
  - Szavazat leadás után: a kiválasztott opció kiemelve, a gomb "Leadva ✓" állapotba vált, nem szavazhat újra
  - Animált megerősítés (checkmark animáció)
- [x] F12.3 Szavazás eredmények:
  - Lezárt szavazásoknál: opciónkénti szavazatszám vízszintes bar chart-tal (Barça színekkel)
  - Helyes válasz zöld kiemelés, a user saját szavazata jelölve
  - Pontszerzés jelzése: ha a user helyesen szavazott, "+50 pont" animált badge
- [x] F12.4 Dashboard widget integráció: ha van aktív szavazás, a dashboard "Aktív szavazás" widgetben egyből szavazhat
- [x] F12.5 Profil "Pontjaim" tab frissítése: szavazásból szerzett pontok megjelennek a tranzakció-történetben

**Acceptance Criteria:**

- Aktív szavazások listázódnak, a user szavazhat
- Egy user csak egyszer szavazhat, utána a felület ezt tükrözi
- Lezárt szavazásoknál az eredmények vizuálisan jelennek meg
- Helyes szavazat esetén a pontszerzés jelzése látható
- A dashboard widget a legfrissebb aktív szavazást mutatja

**Dependencies:** Iteration F1, F5 (dashboard), F10 (profil), Backend Iteration 9

---

### Iteration F13 — Pont-Áruház & Kuponrendszer UI

**Status:** DONE

**Goal:** A pont-áruház felülete: elérhető kuponok böngészése, beváltás, és a kuponkód felhasználása a checkout-ban.

**Backend dependency:** Iteration 10 (Pont-áruház backend)

**Tasks:**

- [x] F13.1 Pont-áruház oldal (`src/app/pont-aruhaz/page.tsx`):
  - Felül: user aktuális pontegyenlege kiemelten
  - Kuponok grid-ben (glass kártyák): kupon neve, leírás, kedvezmény típus ikon (% / fix / szállítás), pont-ár, "Beváltás" gomb
  - Ha nincs elég pont: a gomb inaktív, tooltip-ben "Még X pont szükséges"
- [x] F13.2 Beváltás flow:
  - Megerősítő modal: "Biztosan beváltod? X pont levonásra kerül."
  - Sikeres beváltás: a generált kuponkód megjelenik (másolható), + navigáció a profil kuponok tabra
- [x] F13.3 Profil "Kuponjaim" tab frissítése:
  - Beváltott kuponok listája: kupon neve, kuponkód (másolható), kedvezmény, státusz (aktív / felhasznált)
  - Aktív kuponok kiemelve, felhasználtak halványabban
- [x] F13.4 Checkout kuponintegráció frissítése: a webshop és jegy checkout kuponkód mezőjében beírt kód validálása, kedvezmény megjelenítése az összegzőben

**Acceptance Criteria:**

- A pont-áruház megjeleníti az elérhető kuponokat pontárakkal
- Beváltás csak elegendő pont esetén lehetséges
- A generált kuponkód másolható és megjelenik a profilban
- A kuponkód alkalmazható a webshop és jegy checkout-ban
- Felhasznált kupon státusza frissül

**Dependencies:** Iteration F8 (checkout), F9 (jegy checkout), F10 (profil), Backend Iteration 10

---

### Iteration F14 — Cookie Consent & Analitika Frontend

**Status:** DONE

**Goal:** GDPR cookie consent banner, oldalnézettség tracking implementálása, és az adatvezérelt termékajánlások megjelenítése.

**Backend dependency:** Iteration 11 (Cookie tracking backend)

**Tasks:**

- [x] F14.1 Cookie consent banner (`src/components/common/CookieBanner.tsx`):
  - Az oldal alján megjelenő glass sáv: rövid GDPR szöveg, "Elfogadom" és "Elutasítom" gombok
  - Csak első látogatáskor jelenik meg (cookie/localStorage ellenőrzés)
  - Elfogadás: UUID cookie generálása, consent mentése a backend-re, banner eltűnik
  - Elutasítás: banner eltűnik, nem történik tracking
- [x] F14.2 Page view tracking hook (`src/hooks/usePageTracking.ts`):
  - Automatikusan rögzíti az oldalnézettséget minden route váltásnál (Next.js `usePathname`)
  - Csak ha a user elfogadta a cookie-kat
  - Termék oldalon a `product_id`-t is rögzíti
- [x] F14.3 Adatvezérelt ajánlások megjelenítése:
  - A webshop főoldalon: "Népszerű termékek" szekció a legnézettebb/legjobban értékelt termékekkel
  - A dashboard-on: opcionális "Ajánlott neked" widget (ha van elég adat)

**Acceptance Criteria:**

- A cookie banner megjelenik első látogatáskor, a döntés megjegyződik
- Elfogadás után az oldalnézettség rögzítődik
- Elutasítás után nem történik tracking
- A népszerű termékek szekció a valós nézettségi adatok alapján rangsorol

**Dependencies:** Iteration F8 (webshop), Backend Iteration 11

---

### Iteration F15 — Admin Panel Frontend

**Status:** TODO

**Goal:** A teljes admin felület megvalósítása: sidebar navigáció, CRUD felületek minden modulhoz, analitika dashboard.

**Backend dependency:** Iteration 3-12 (az admin panel az összes backend modult lefedi)

**Tasks:**

- [ ] F15.1 Admin layout (`src/app/admin/layout.tsx`):
  - Bal oldali sidebar: navigáció az admin szekciókhoz (Cikkek, Termékek, Rendelések, Meccsek, Játékosok, Posztok, Szavazások, Kuponok, Analitika)
  - Ikonok minden menüpontnál (Lucide icons)
  - Mobil: a sidebar hamburger menüként nyílik
  - Tartalom terület: középen, max szélességgel
  - shadcn/ui komponensek: Table, Form, Dialog, Select, Badge, stb.
  - NEM liquid glass — tiszta, funkcionális admin design a dark/light témával
- [ ] F15.2 Cikkek kezelése (`src/app/admin/cikkek/page.tsx`):
  - Lista: táblázat (cím, kategória, dátum, műveletek)
  - Létrehozás/szerkesztés: form (cím, tartalom Tiptap rich text editorral, kategória select, kép feltöltés drag & drop)
  - Törlés: megerősítő modal
- [ ] F15.3 Termékek kezelése (`src/app/admin/termekek/page.tsx`):
  - Lista: táblázat (név, kategória, ár, összkészlet, műveletek)
  - Létrehozás/szerkesztés: form (név, leírás, ár, kategória, kép feltöltés, variánsok: dinamikus méret/szín/készlet sorok hozzáadása)
  - Készlet gyors módosítás inline
- [ ] F15.4 Rendelések kezelése (`src/app/admin/rendelesek/page.tsx`):
  - Lista: táblázat (rendelés ID, user, összeg, státusz badge, dátum)
  - Státusz szűrő (feldolgozás / feladva / kézbesítve / lemondva)
  - Státusz léptetés gombok: "Feladva" → "Kézbesítve" (megerősítéssel)
  - Rendelés részletei: tételek listája, szállítási cím
- [ ] F15.5 Meccsek & szektorok kezelése (`src/app/admin/meccsek/page.tsx`):
  - "Meccsek szinkronizálása" gomb (API-Football-ból)
  - Meccslista: táblázat (csapatok, dátum, státusz)
  - Szektor kezelés: meccsre kattintva szektorok hozzáadása/szerkesztése (szektor név, összes hely, eladott helyek)
- [ ] F15.6 Játékosok kezelése (`src/app/admin/jatekosok/page.tsx`):
  - "Játékosok szinkronizálása" gomb (API-Football-ból)
  - Játékos lista: táblázat (név, pozíció, mezszám)
  - Szerkesztés: bio mező (textarea), egyedi adatok, kép módosítás
- [ ] F15.7 Posztok & kommentek moderálás (`src/app/admin/posztok/page.tsx`):
  - Poszt létrehozás: szöveg + kép feltöltés
  - Poszt lista: szerkesztés/törlés
  - Komment moderálás: az egyes posztokhoz tartozó kommentek listája, törlés gomb
- [ ] F15.8 Szavazások kezelése (`src/app/admin/szavazasok/page.tsx`):
  - Szavazás létrehozás: kérdés + opciók dinamikusan hozzáadhatók + opcionális meccs kiválasztása
  - Lista: aktív/lezárt szűrő
  - Lezárás: helyes válasz kiválasztása → megerősítő modal → pontszétosztás automatikusan
- [ ] F15.9 Kuponok kezelése (`src/app/admin/kuponok/page.tsx`):
  - Lista: táblázat (név, típus, pontár, beváltások száma, státusz)
  - Létrehozás: form (név, leírás, kedvezmény típus, érték, pontár)
  - Aktiválás/deaktiválás toggle
- [ ] F15.10 Értékelések moderálása (`src/app/admin/ertekelesek/page.tsx`):
  - Lista: összes értékelés (termék, user, csillagok, szöveg, látható/rejtett)
  - Elrejtés/megjelenítés toggle gomb
- [ ] F15.11 Analitika dashboard (`src/app/admin/analitika/page.tsx`):
  - Összesítő kártyák felül: összes user, összes rendelés, összes bevétel, aktív szavazások
  - Recharts grafikonok: legnézettebb oldalak (bar chart, top 20), legnézettebb termékek (bar chart, top 20)
  - Időszak szűrő (utolsó 7 nap / 30 nap / összes)

**Acceptance Criteria:**

- Minden admin funkció elérhető és működik a UI-ról
- CRUD műveletek (létrehozás, szerkesztés, törlés) minden modulban működnek
- Az API szinkronizáció gombok működnek és visszajelzést adnak (loading, sikeres, hibás)
- Az analitika dashboard valós adatokat mutat grafikonokkal
- Az admin panel mobilon is használható (sidebar hamburger)
- Nem-admin user az admin URL-ekre navigálva visszairányítódik

**Dependencies:** Iteration F1, F4, Backend Iterations 3-12

---

### Iteration F16 — Responsive Polish & Végső Tesztelés

**Status:** TODO

**Goal:** Az összes oldal responsive viselkedésének véglegesítése, cross-browser tesztelés, performance optimalizáció, és a teljes user journey end-to-end tesztelése.

**Tasks:**

- [ ] F16.1 Responsive audit: minden oldal átnézése 3 breakpoint-on (mobil 375px, tablet 768px, desktop 1280px), javítások ahol szükséges
- [ ] F16.2 Liquid glass performance audit: mobilon max 5-6 glass elem viewport-ban egyszerre, listaoldalakon solid háttér glass helyett, performance mérés
- [ ] F16.3 `backdrop-filter` fallback: régebbi böngészőkben (ahol nem támogatott) solid háttérszín fallback `@supports` media query-vel
- [ ] F16.4 Dark/light mode végső ellenőrzés: minden oldal mindkét témában vizuálisan helyes, kontraszt WCAG AA, nincs "elfelejtett" elem ami nem követi a témát
- [ ] F16.5 Animáció finomhangolás: minden Framer Motion animáció `prefers-reduced-motion` media query-t tiszteletben tartja (csökkentett mozgás preferencia esetén nincs animáció)
- [ ] F16.6 Lighthouse audit: minden fő oldal minimum 80-as mobile score (Performance, Accessibility, Best Practices, SEO)
- [ ] F16.7 End-to-end user journey teszt: regisztráció → landing page → dashboard → hírek böngészés → webshop vásárlás → jegyvásárlás → szavazás → pont beváltás → kupon használat → profil ellenőrzés
- [ ] F16.8 End-to-end admin journey teszt: login → cikk létrehozás → termék + variáns létrehozás → meccs szinkronizálás → szektor létrehozás → poszt írás → szavazás létrehozás és lezárás → kupon létrehozás → analitika megtekintés
- [ ] F16.9 Error state-ek ellenőrzése: 404 oldal, hálózati hiba kezelés, üres listák, betöltési hibák — mindenhol legyen barátságos hibaüzenet
- [ ] F16.10 Loading state-ek ellenőrzése: minden adatot betöltő oldal/komponens skeleton loader-t mutat, nem üres képernyőt

**Acceptance Criteria:**

- Az alkalmazás minden fő oldalon responsive és vizuálisan helyes 3 breakpoint-on
- A liquid glass effektek mobilon nem okoznak performance problémát
- Mindkét téma (dark/light) konzisztens és WCAG AA kontraszt-megfelelő
- A Lighthouse mobile score minden fő oldalon >= 80
- A teljes user és admin journey hiba nélkül végigfut
- Minden hiba- és loading állapot kezelt

**Dependencies:** Iteration F1-F15 (mind)

---
