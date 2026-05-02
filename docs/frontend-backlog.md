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
| Total tasks | 172 |
| Completed tasks | 172 |
| Remaining tasks | 0 |
| Completion | 100% |

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

**Status:** DONE

**Goal:** A játékos böngésző felülete: csapatkeretlista pozíció szerinti csoportosítással, játékos kártyák flip animációval desktopra, és részletes játékos profil oldal statisztika vizualizációkkal.

**Backend dependency:** Iteration 4 (API-Football integráció)

**Tasks:**

- [x] F7.1 Játékos lista oldal (`src/app/jatekosok/page.tsx`):
  - Pozíció szerinti csoportosítás (szekciók): Kapusok, Védők, Középpályások, Támadók
  - Szekció fejlécek a pozíció nevével
  - Grid elrendezés szekción belül: desktop 4 oszlop, tablet 3, mobil 2
- [x] F7.2 Játékos kártya komponens (`src/components/players/PlayerCard.tsx`):
  - **Elülső oldal:** játékos képe, neve, mezszáma (nagy számmal), pozíció badge
  - **Hátulsó oldal (csak desktop, `@media (hover: hover)`):** 3-4 fő statisztika (gólok, gólpasszok, meccsek, sárga lapok) + "Profil megtekintése" gomb
  - **Desktop hover:** kártya flip animáció (CSS `transform: rotateY(180deg)` + `backface-visibility: hidden`, transition 0.6s)
  - **Mobil:** nincs flip, a kártya mindig az elülső oldalt mutatja + alul 2-3 fő stat szám, tap → profil oldal
- [x] F7.3 Pozíció szűrő: pill gombok a lista felett (Mind, Kapus, Védő, Középpályás, Támadó) — hasonló a hír kategória szűrőhöz
- [x] F7.4 Játékos profil oldal (`src/app/jatekosok/[id]/page.tsx`):
  - Hero szekció: játékos képe (bal), név + mezszám + pozíció (jobb), glass kártya háttér
  - Statisztikák vizuális megjelenítéssel: progress bar-ok vagy Recharts sugárdiagram (radar chart) a teljesítményhez (gólok, gólpasszok, meccsek, sárga/piros lapok)
  - Bio szekció: az admin által írt szöveges leírás
  - "Vissza a kerethez" navigáció
- [x] F7.5 Landing page carousel bekötése: az F3.3-ban hardkódolt adatok lecserélése élő API adatokra (top 3-4 játékos automatikus kiválasztása)

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

**Status:** DONE

**Goal:** A jegyvásárlási felület: meccsek listája, SVG stadion szektor térkép, jegyválasztó és demo vásárlás.

**Backend dependency:** Iteration 6 (Jegyrendszer backend)

**Tasks:**

- [x] F9.1 Meccsek listaoldal (`src/app/jegyek/page.tsx`):
  - Időrendi lista kártyákban: két csapat neve/logója, dátum, helyszín
  - Státusz badge-ek: "Jegyvásárlás elérhető" (zöld), "Hamarosan" (sárga), "Lejátszott" (szürke)
  - Kattintás → meccs részletek / jegyvásárlás oldal
- [x] F9.2 SVG stadion szektor térkép (`src/components/tickets/StadiumMap.tsx`):
  - Sematikus stadion forma SVG-ben: ovális/téglalap alakú stadion körvonal, 6-8 szektor blokk elrendezve a stadion formán
  - Minden szektor kattintható, a szektorra hover-nél tooltip a nevével, szabad helyek számával és jegyárral
  - Színkódolás: elérhető szektor → akcentszín, betelt szektor → szürke/inaktív, kiválasztott szektor → arany kiemelés
  - Mobilon a térkép zoom-olható/görgethető legyen (vagy alatta lista alternatívaként)
- [x] F9.3 Jegyválasztó panel (a térkép mellett vagy alatt):
  - Kiválasztott szektor neve, szabad helyek száma, és jegyár/db
  - Mennyiség választó (1-4, max limit jelezve)
  - Ár összesítő (jegyár × mennyiség)
  - "Jegyvásárlás (demo)" CTA gomb
  - Opcionális kuponkód mező
- [x] F9.4 Sikeres vásárlás megerősítés: a megvásárolt jegyek részletei (szektor, székszámok, dátum), "jegy-kártya" megjelenítés vizuálisan (mint egy digitális jegy)
- [x] F9.5 Mobil alternatíva: ha a stadion SVG mobilon túl kicsi, alatta egy lista/grid a szektorokkal (kártyák: szektor neve, szabad/összes hely, állapot pill), a térkép opcionális

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

**Status:** DONE

**Goal:** A felhasználói profiloldal (adatkezelés, vásárlási előzmények, pont-történet) és a command palette stílusú globális kereső megvalósítása.

**Backend dependency:** Iteration 7 (Profil & kereső backend)

**Tasks:**

- [x] F10.1 Profil oldal layout (`src/app/profil/page.tsx`):
  - Felső szekció: profilkép (körkivágás, kattintásra módosítható — file input + crop preview), becenév (inline szerkeszthető), pontegyenleg nagy számmal
  - Alatta tab navigáció: "Rendeléseim", "Jegyeim", "Kuponjaim", "Pontjaim", "Beállítások"
  - Desktop: horizontális tabok
  - Mobil: horizontálisan görgethető pill gombok
- [x] F10.2 "Rendeléseim" tab:
  - Rendelések timeline/lista: dátum, tételek összegzése, összeg, státusz badge (feldolgozás → feladva → kézbesítve, színkódolt)
  - Lemondás gomb ahol elérhető (megerősítő modal-lal)
- [x] F10.3 "Jegyeim" tab:
  - Megvásárolt jegyek kártyái: meccs adatai, szektor, székszám(ok), dátum
  - Közelgő meccs jegyei kiemelve, lejátszott meccsek halványabban
- [x] F10.4 "Pontjaim" tab:
  - Aktuális egyenleg kiemelten
  - Tranzakció-történet lista: dátum, összeg (+50 / -200), ok (szavazás nyeremény / kupon beváltás)
- [x] F10.5 "Beállítások" tab:
  - Becenév módosítás form
  - Jelszóváltoztatás form (jelenlegi jelszó, új jelszó, megerősítés)
  - Profilkép feltöltés (drag & drop vagy kattintás)
- [x] F10.6 Command palette kereső (`src/components/search/CommandPalette.tsx`):
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

**Status:** DONE

**Goal:** A teljes admin felület megvalósítása: sidebar navigáció, CRUD felületek minden modulhoz, analitika dashboard.

**Backend dependency:** Iteration 3-12 (az admin panel az összes backend modult lefedi)

**Tasks:**

- [x] F15.1 Admin layout (`src/app/admin/layout.tsx`):
  - Bal oldali sidebar: navigáció az admin szekciókhoz (Cikkek, Termékek, Rendelések, Meccsek, Játékosok, Posztok, Szavazások, Kuponok, Analitika)
  - Ikonok minden menüpontnál (Lucide icons)
  - Mobil: a sidebar hamburger menüként nyílik
  - Tartalom terület: középen, max szélességgel
  - shadcn/ui komponensek: Table, Form, Dialog, Select, Badge, stb.
  - NEM liquid glass — tiszta, funkcionális admin design a dark/light témával
- [x] F15.2 Cikkek kezelése (`src/app/admin/cikkek/page.tsx`):
  - Lista: táblázat (cím, kategória, dátum, műveletek)
  - Létrehozás/szerkesztés: form (cím, tartalom Tiptap rich text editorral, kategória select, kép feltöltés drag & drop)
  - Törlés: megerősítő modal
- [x] F15.3 Termékek kezelése (`src/app/admin/termekek/page.tsx`):
  - Lista: táblázat (név, kategória, ár, összkészlet, műveletek)
  - Létrehozás/szerkesztés: form (név, leírás, ár, kategória, kép feltöltés, variánsok: dinamikus méret/szín/készlet sorok hozzáadása)
  - Készlet gyors módosítás inline
- [x] F15.4 Rendelések kezelése (`src/app/admin/rendelesek/page.tsx`):
  - Lista: táblázat (rendelés ID, user, összeg, státusz badge, dátum)
  - Státusz szűrő (feldolgozás / feladva / kézbesítve / lemondva)
  - Státusz léptetés gombok: "Feladva" → "Kézbesítve" (megerősítéssel)
  - Rendelés részletei: tételek listája, szállítási cím
- [x] F15.5 Meccsek & szektorok kezelése (`src/app/admin/meccsek/page.tsx`):
  - "Meccsek szinkronizálása" gomb (API-Football-ból)
  - Meccslista: táblázat (csapatok, dátum, státusz)
  - Szektor kezelés: meccsre kattintva szektorok hozzáadása/szerkesztése (szektor név, összes hely, eladott helyek)
- [x] F15.6 Játékosok kezelése (`src/app/admin/jatekosok/page.tsx`):
  - "Játékosok szinkronizálása" gomb (API-Football-ból)
  - Játékos lista: táblázat (név, pozíció, mezszám)
  - Szerkesztés: bio mező (textarea), egyedi adatok, kép módosítás
- [x] F15.7 Posztok & kommentek moderálás (`src/app/admin/posztok/page.tsx`):
  - Poszt létrehozás: szöveg + kép feltöltés
  - Poszt lista: szerkesztés/törlés
  - Komment moderálás: az egyes posztokhoz tartozó kommentek listája, törlés gomb
- [x] F15.8 Szavazások kezelése (`src/app/admin/szavazasok/page.tsx`):
  - Szavazás létrehozás: kérdés + opciók dinamikusan hozzáadhatók + opcionális meccs kiválasztása
  - Lista: aktív/lezárt szűrő
  - Lezárás: helyes válasz kiválasztása → megerősítő modal → pontszétosztás automatikusan
- [x] F15.9 Kuponok kezelése (`src/app/admin/kuponok/page.tsx`):
  - Lista: táblázat (név, típus, pontár, beváltások száma, státusz)
  - Létrehozás: form (név, leírás, kedvezmény típus, érték, pontár)
  - Aktiválás/deaktiválás toggle
- [x] F15.10 Értékelések moderálása (`src/app/admin/ertekelesek/page.tsx`):
  - Lista: összes értékelés (termék, user, csillagok, szöveg, látható/rejtett)
  - Elrejtés/megjelenítés toggle gomb
- [x] F15.11 Analitika dashboard (`src/app/admin/analitika/page.tsx`):
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

**Status:** DONE

**Goal:** Az összes oldal responsive viselkedésének véglegesítése, cross-browser tesztelés, performance optimalizáció, és a teljes user journey end-to-end tesztelése.

**Tasks:**

- [x] F16.1 Responsive audit: minden oldal átnézése 3 breakpoint-on (mobil 375px, tablet 768px, desktop 1280px), javítások ahol szükséges
- [x] F16.2 Liquid glass performance audit: mobilon max 5-6 glass elem viewport-ban egyszerre, listaoldalakon solid háttér glass helyett, performance mérés
- [x] F16.3 `backdrop-filter` fallback: régebbi böngészőkben (ahol nem támogatott) solid háttérszín fallback `@supports` media query-vel
- [x] F16.4 Dark/light mode végső ellenőrzés: minden oldal mindkét témában vizuálisan helyes, kontraszt WCAG AA, nincs "elfelejtett" elem ami nem követi a témát
- [x] F16.5 Animáció finomhangolás: minden Framer Motion animáció `prefers-reduced-motion` media query-t tiszteletben tartja (csökkentett mozgás preferencia esetén nincs animáció)
- [x] F16.6 Lighthouse audit: minden fő oldal minimum 80-as mobile score (Performance, Accessibility, Best Practices, SEO)
- [x] F16.7 End-to-end user journey teszt: regisztráció → landing page → dashboard → hírek böngészés → webshop vásárlás → jegyvásárlás → szavazás → pont beváltás → kupon használat → profil ellenőrzés
- [x] F16.8 End-to-end admin journey teszt: login → cikk létrehozás → termék + variáns létrehozás → meccs szinkronizálás → szektor létrehozás → poszt írás → szavazás létrehozás és lezárás → kupon létrehozás → analitika megtekintés
- [x] F16.9 Error state-ek ellenőrzése: 404 oldal, hálózati hiba kezelés, üres listák, betöltési hibák — mindenhol legyen barátságos hibaüzenet
- [x] F16.10 Loading state-ek ellenőrzése: minden adatot betöltő oldal/komponens skeleton loader-t mutat, nem üres képernyőt

**Acceptance Criteria:**

- Az alkalmazás minden fő oldalon responsive és vizuálisan helyes 3 breakpoint-on
- A liquid glass effektek mobilon nem okoznak performance problémát
- Mindkét téma (dark/light) konzisztens és WCAG AA kontraszt-megfelelő
- A Lighthouse mobile score minden fő oldalon >= 80
- A teljes user és admin journey hiba nélkül végigfut
- Minden hiba- és loading állapot kezelt

**Dependencies:** Iteration F1-F15 (mind)

---

### Iteration F17 — Frontend Módosítások a football-data.org Átálláshoz

**Status:** DONE

**Goal:** Az API-Football → football-data.org átállás (Backend Iteration 13) által érintett frontend elemek frissítése. A backend endpoint-ok interfésze nagyrészt változatlan marad, viszont a meccs adatokban mostantól csapat logó URL-ek (`home_team_crest`, `away_team_crest`) is érkeznek, amiket meg kell jeleníteni. A játékos statisztikák valódi értékeket tartalmaznak (gólok, gólpasszok, lejátszott meccsek a football-data.org scorers API-ból), így a meglévő stat-vizualizációk élnek. A felületi szövegek aktualizálása szintén szükséges.

**Backend dependency:** Backend Iteration 13 (football-data.org átállás)

**Tasks:**

- [x] F17.1 Admin szinkronizáció gombok UX frissítése (`src/app/admin/jatekosok/page.tsx`, `src/app/admin/meccsek/page.tsx`):
  - A "Játékosok szinkronizálása" és "Meccsek szinkronizálása" gombok loading állapotának finomítása: a football-data.org sokkal gyorsabb mint a scraping volt (10 hívás/perc rate limit, de tipikusan 1-2 hívás elég egy szinkronizációhoz), ezért a sima spinner + rövid loading szöveg elegendő
  - Loading szöveg: "Szinkronizálás folyamatban..." (másodpercek-tíz másodperc nagyságrend)
  - A gomb inaktív marad a szinkronizáció alatt (dupla kattintás védelem)
- [x] F17.2 Csapat logók megjelenítése a meccs felületeken:
  - **Meccs kártyák** (`src/app/jegyek/page.tsx`, dashboard "Következő meccs" widget — F5.2, közösségi feed meccs hivatkozások): a `home_team_crest` és `away_team_crest` URL-eket meg kell jeleníteni a csapatnevek mellett (`<Image>` komponens, kis méretű kerek vagy négyzetes logó)
  - **Jegy oldal** (`src/app/jegyek/[id]/page.tsx`): a meccs hero szekciójában a két csapat logója nagyobb méretben jelenjen meg
  - **Megvásárolt jegyek** (`src/app/profil` Jegyeim tab): a jegy kártyán a csapat logók is látszódjanak
  - Fallback: ha a `home_team_crest` vagy `away_team_crest` `null`, helyette egy default placeholder ikon vagy a csapatnév kezdőbetűi jelenjenek meg
- [x] F17.3 Admin felületi szövegek aktualizálása:
  - Minden "API-Football"-ra hivatkozó szöveg, tooltip, placeholder cseréje: "API-Football" → "football-data.org"
  - A szinkronizáció gombok melletti info tooltip frissítése: "Az adatok a football-data.org API-ról kerülnek lekérésre. A játékos képeket az admin manuálisan tölti fel a játékos szerkesztő felületen."
- [x] F17.4 Szinkronizáció eredmény toast-ok:
  - Sikeres szinkronizáció → zöld toast: "Szinkronizáció sikeres: [X] játékos / [Y] meccs frissítve"
  - Részleges siker → sárga toast: "Szinkronizáció kész: [X] játékos frissítve, [figyelmeztetés]"
  - Hiba → piros toast: "Szinkronizáció sikertelen: [hibaüzenet]. A meglévő adatok érintetlenek."
- [x] F17.5 TypeScript típusok frissítése:
  - A `Match` típus (vagy ekvivalens) kiegészítése `home_team_crest: string | null` és `away_team_crest: string | null` mezőkkel a `src/types/database.ts`-ben (vagy ahol a meccs típus deklarálva van)
  - A meccs adatokat fogyasztó komponensek típushibák nélkül használják az új mezőket

**Acceptance Criteria:**

- A szinkronizáció gombok loading állapota tiszta és informatív
- Az admin nem tudja duplán kattintani a gombot szinkronizáció közben
- A meccs kártyákon és a jegy oldalon mindkét csapat logója megjelenik (ha a backend visszaadja az URL-t)
- A logo fallback (null érték esetén) értelmes placeholder-t mutat
- A játékos kártyák és profil oldalak megjelenítik a valódi statisztikákat (gólok, gólpasszok, lejátszott meccsek) a football-data.org scorers API-ból
- Semmilyen "API-Football" hivatkozás nem maradt a felületen
- A szinkronizáció eredménye toast-ban jelenik meg (sikeres / részleges / hibás)
- A publikus felhasználói felület (jegyvásárlás, játékos lista) hibamentesen működik az új adatokkal
- A játékos képek az admin által manuálisan feltöltött képek; ha egy játékoshoz nincs feltöltve kép, default avatar/placeholder látszik

**Dependencies:** Iteration F1 (toast rendszer), F7 (játékos UI), F9 (jegy UI), F15 (admin panel), Backend Iteration 13
 
---

### Iteration F18 — Kritikus Bug Fixek & UX Gyors Javítások

**Status:** DONE

**Goal:** Az éles használat során feltárt kritikus frontend hibák kijavítása: admin meccs szektor undefined render, jegyvásárlás TypeError, wishlist navigáció hiánya, hírek HTML tag render, poll_win felirat hiba.

**Backend dependency:** Backend Iteration 14 (kritikus bug fixek backend oldalon)

**Tasks:**

- [x] F18.1 Admin meccs szektor undefined render javítás (#7):
  - `src/app/admin/meccsek/[id]/page.tsx` (vagy ekvivalens szektor lista komponens): a szektorok render-ezésénél optional chaining + fallback érték minden mezőre (sector_name, total_seats, sold_seats, price)
  - Ha a meccsnek nincs szektora, "Nincsenek szektorok" üzenet (és — F20-tól kezdve — auto-seed gomb javaslat)
- [x] F18.2 Jegyvásárlás TypeError javítás (#8):
  - `src/app/jegyek/[id]/page.tsx` és `src/components/tickets/TicketPurchasePanel.tsx`: a vásárlási flow inputjainak null/undefined védelem (sector_id, quantity)
  - A backend response feldolgozásakor type guard a `sectors` tömbre
  - Hibakezelés: ha a backend hibát ad, toast üzenet + retry opció
- [x] F18.3 Wishlist navigáció hozzáadása (#9):
  - A profil oldal tab listájába "Kívánságlistám" tab vagy a navbar profil dropdown-ba "Kívánságlistám" menüpont
  - A meglévő `/wishlist` route-ra navigál
  - Ellenőrzés: az oldal funkcionális (`src/app/wishlist/page.tsx` 194 soros, létezik)
- [x] F18.4 Hírek HTML tag render javítás (#10):
  - `src/app/hirek/[id]/page.tsx` (és minden cikk tartalom render): `dangerouslySetInnerHTML` használat helyett (vagy mellett) HTML sanitizer integráció
  - `isomorphic-dompurify` telepítése: `npm install isomorphic-dompurify`
  - Helper függvény (`src/lib/sanitize.ts`): `sanitizeHtml(html: string)` ami DOMPurify-jal tisztítja a Tiptap által generált HTML-t (engedélyezett tagek: p, h1-h6, ul, ol, li, a, strong, em, blockquote, code, br, img)
  - A cikk render: `<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content) }} />`
- [x] F18.5 Poll_win felirat javítás (#14):
  - A pont tranzakció listán (`src/app/profil` Pontjaim tab) a `reason = 'poll_win'` érték magyar fordítása: "Szavazás nyeremény"
  - Helper map (`src/lib/i18n/transaction-reasons.ts`): `{ 'poll_win': 'Szavazás nyeremény', 'coupon_redeem': 'Kupon beváltás', ... }`
  - Minden tranzakció megjelenítő helyen (profil, dashboard widget) ezt használja
- [x] F18.6 Regressziós tesztelés: minden javított oldal manuális kipróbálása desktop + mobil view-ban

**Acceptance Criteria:**

- Admin meccs szektor lista hibamentesen rendereli az adatokat (vagy üres üzenetet)
- Jegyvásárlás folyamata nem dob TypeError-t
- A wishlist oldal navigációval elérhető a profilból vagy a navbar-ból
- A hírek tartalmában a HTML formatázás helyesen jelenik meg, nem nyersen
- A pont tranzakció listán a "Szavazás nyeremény" felirat látszik

**Dependencies:** Backend Iteration 14, Iteration F10 (profil), F15 (admin)

---

### Iteration F19 — Dashboard: La Liga Tabella & Góllövőlista Widget

**Status:** DONE

**Goal:** A dashboard kibővítése két új widgettel: La Liga állás (top 5 + lenyitható teljes tabella, FC Barcelona kiemelve) és góllövőlista (top 5-10). A widgetek a Backend Iteration 15-ben létrehozott `/api/standings` és `/api/scorers` endpointokat fogyasztják.

**Backend dependency:** Backend Iteration 15 (standings & scorers API)

**Tasks:**

- [x] F19.1 "La Liga állás" widget komponens (`src/components/dashboard/StandingsWidget.tsx`):
  - Glass kártya, fejléc: "La Liga állás" + verseny logó (opcionális)
  - Adatlekérés: `GET /api/standings?competition=2014` (SWR vagy React Query)
  - Top 5 sor megjelenítése táblázatos formában: pozíció, csapat logó + név, M (mérkőzés), P (pont), GA (gólarány)
  - FC Barcelona sorának kiemelése (pl. arany akcent háttér, vastag betű)
  - "Teljes tabella megtekintése" link/gomb → expandable szekció vagy modal a teljes 20 csapattal
  - Skeleton loading állapot (5 placeholder sor)
  - Error state: barátságos hibaüzenet + retry gomb
- [x] F19.2 "Góllövőlista" widget komponens (`src/components/dashboard/TopScorersWidget.tsx`):
  - Glass kártya, fejléc: "La Liga góllövőlista"
  - Adatlekérés: `GET /api/scorers?competition=2014&limit=10`
  - Top 5 alapból, "Több" gomb a top 10-re
  - Sor: pozíció, játékos név, csapat (kis logóval), gólok száma kiemelten
  - FC Barcelona játékosok kiemelése (akcent szín)
  - Skeleton loading + error state ugyanazzal a mintával mint az F19.1
- [x] F19.3 Dashboard layout integráció (`src/app/dashboard/page.tsx`):
  - A két új widget elhelyezése a CSS grid-ben (desktop: span-1 vagy span-2 a többi widget mellé, mobil: 1 oszlop stack)
  - A widgetek pozícionálása: a "Következő meccs" widget után, "Pontegyenlegem" előtt vagy mellett
  - Layout responsive teszt
- [x] F19.4 Expandable teljes tabella UI (vagy modal):
  - Megoldás A: a widgeten belül expandable szekció (animáció: max-height + opacity, Framer Motion)
  - Megoldás B: glass modal full table-lel, scroll-able mobil viewra
  - Választás: expandable szekció (kevésbé tolakodó)
  - Tartalom: mind a 20 csapat, ugyanazokkal az oszlopokkal
- [x] F19.5 Cache-elt adat UX: ha a backend cache-ből szolgáltat (lassan frissül), egy diszkrét "frissítve: X órája" felirat a widget alján opcionális

**Acceptance Criteria:**

- A La Liga tabella widget a dashboardon megjelenik a top 5 csapattal
- FC Barcelona vizuálisan kiemelve
- Az expandable / modal a teljes tabellát mutatja
- A góllövőlista widget működik, top 5 (vagy top 10) gólszerzővel
- A widgetek responsive megjelennek mobilon
- A loading és error állapotok kezelve vannak

**Dependencies:** Iteration F5 (dashboard layout), Backend Iteration 15

---

### Iteration F20 — Jegyek Táblázatos Nézet & Fix Szektor SVG Redesign

**Status:** DONE

**Goal:** Két frontend változás: (1) a meccs lista oldal (`/jegyek`) átalakítása táblázatos megjelenítésre, a kártya nézet teljesen megszűnik. (2) A `StadiumMap.tsx` újratervezése a 4 fix szektor (TRIBUNA, LATERAL, GOL NORD, GOL SUD) referencia kép alapján, fix SVG koordinátákkal, dinamikus kapacitás és ár megjelenítéssel.

**Backend dependency:** Backend Iteration 16 (fix szektor architektúra)

**Tasks:**

- [x] F20.1 Meccsek listaoldal táblázatos átalakítás (`src/app/jegyek/page.tsx`):
  - A korábbi kártya grid lecserélése táblázatos nézetre
  - Oszlopok: dátum, hazai csapat (logó + név), vendég csapat (logó + név), bajnokság, státusz badge, "Jegyvásárlás" gomb
  - Mobil: a táblázat helyett kompakt sor-alapú lista (a meccs egy "row" mint kártya, de a táblázat struktúráját megőrizve)
  - Sticky header desktopra
  - Sorting: dátum szerint (alap aszc, kattintásra desc)
  - Filter: bajnokság szerint (La Liga, BL, Copa del Rey)
  - A kártya nézet kód törlése (komponensek, stílusok)
- [x] F20.2 Fix szektor SVG újratervezés (`src/components/tickets/StadiumMap.tsx`):
  - Korábbi 6-8 szektoros SVG eltávolítása
  - 4 fix szektor SVG koordinátáinak beállítása a referencia kép alapján:
    - TRIBUNA: a stadion északi/hosszú oldala (nagyobb téglalap fent)
    - LATERAL: a stadion déli/hosszú oldala (nagyobb téglalap lent)
    - GOL NORD: a stadion északi végén (kapu mögött)
    - GOL SUD: a stadion déli végén (kapu mögött)
  - Minden szektor `<path>` vagy `<polygon>` elem konkrét D-attributummal vagy points-szel
  - SVG viewBox: pl. `0 0 800 600` arányos
- [x] F20.3 Szektor adat-binding:
  - A szektor SVG elemei az ID-ja vagy `data-sector-name` attribútuma alapján kapnak állapotot
  - Hover: tooltip a szektor nevével, szabad helyek számával, ár/db
  - Színkódolás (változatlan): elérhető akcent, betelt szürke, kiválasztott arany
  - Kattintható szektor → kiválasztva állapot
- [x] F20.4 Dinamikus kapacitás és ár megjelenítés:
  - Minden szektor labelje (név) + alatta a szabad helyek (`total_seats - sold_seats`) / összes helyek és az ár (€) kiírva, vagy csak hover tooltip-ben
  - Ha a backend válasz módosul (admin árváltoztatás után), a térkép friss adatot mutat (SWR cache invalidálás vagy manual refetch)
- [x] F20.5 Mobil alternatíva frissítés (F9.5 frissítése):
  - A mobil fallback lista 4 szektort mutat (TRIBUNA, LATERAL, GOL NORD, GOL SUD), egy-egy kártyával
  - Kártya: szektor neve, szabad/összes hely, ár, "Kiválaszt" gomb
- [x] F20.6 Admin szektor szerkesztő frissítés (`src/app/admin/meccsek/[id]/page.tsx`):
  - Az "Új szektor hozzáadása" gomb eltávolítása (a 4 fix szektor automatikusan létrejön)
  - A 4 szektor szerkesztő formja: minden szektor egy sor, csak `total_seats` és `price` szerkeszthető (a `sector_name` readonly)
  - Auto-seed gomb: ha egy meccsnek hiányzik szektora (régi adat), egy "Szektorok újragenerálása" gomb a `POST /api/admin/matches/[id]/seed-sectors` endpointot hívja
- [x] F20.7 Konstans import (`src/lib/constants/sectors.ts`):
  - A backend által definiált 4 szektor név konstansot a frontend is használja (típusbiztos)

**Acceptance Criteria:**

- A `/jegyek` oldal táblázatos nézetet mutat, sorting és filtering működik
- A kártya nézet teljesen el lett távolítva (kódból is)
- A `StadiumMap.tsx` a 4 fix szektort jeleníti meg fix elrendezésben (referencia kép alapján)
- A hover tooltip a szabad helyeket és az árat mutatja
- Az admin szektor szerkesztő csak árat és kapacitást enged módosítani
- Mobil fallback lista a 4 szektort mutatja

**Dependencies:** Iteration F9 (jegyek UI), F15 (admin), Backend Iteration 16

---

### Iteration F21 — Szavazás UI: "Más / Egyik sem" Opció

**Status:** DONE

**Goal:** A szavazórendszer UI kibővítése: az admin a szavazás létrehozó form-ban hozzáadhatja a "Más / Egyik sem" opciót egy checkbox-szal és egy testreszabható szöveggel. A szavazó UI és az eredmény megjelenítés is támogatja ezt.

**Backend dependency:** Backend Iteration 17 ("Más / Egyik sem" opció backend)

**Tasks:**

- [x] F21.1 Admin szavazás létrehozó form frissítése (`src/app/admin/szavazasok/page.tsx` + `SzavazasForm.tsx`):
  - Új checkbox: "'Más / Egyik sem' opció hozzáadása"
  - Ha be van pipálva: text input a szöveg testreszabására (default: "Más / Egyik sem"), max 100 karakter
  - Submit-kor a `addNoneOption` és `noneOptionText` body field-ek átadása a backendnek
- [x] F21.2 Admin szerkesztő form frissítése:
  - A meglévő szavazás szerkesztésekor a "none" opció jelölve van (ha van)
  - Lehetőség a hozzáadásra/eltávolításra (csak resolve előtt)
- [x] F21.3 User szavazás UI frissítése (`src/app/szavazasok/page.tsx` + `PollCard.tsx`):
  - A "none" opció vizuálisan elkülönítve jelenjen meg (pl. szürkébb háttér, dőlt betű, vagy egy elválasztó vonal a normál opciók után)
  - Ikon (pl. kérdőjel) a "none" opció mellett
- [x] F21.4 Eredmény megjelenítés frissítése:
  - Lezárt szavazásnál ha a `correct_option = 'none'`: a "none" opció zöld kiemelést kap
  - A bar chart-on a "none" opció külön színnel (pl. szürke vagy lila)
  - Ha a user a "none"-ra szavazott és az volt a helyes: "+50 pont" badge megjelenik (ugyanaz a logika mint a normál helyes válasznál)
- [x] F21.5 Admin lezáró form frissítése:
  - A "Helyes válasz kiválasztása" select tartalmazza a "none" opciót is (ha a szavazásnak van ilyen)

**Acceptance Criteria:**

- Admin tud "Más / Egyik sem" opciót hozzáadni szavazás létrehozásakor
- A szavazó UI vizuálisan elkülöníti a "none" opciót
- Lezáráskor a "none" választható helyes válaszként
- Aki a "none"-ra szavazott és az volt a helyes, kapja a 50 pontot, és látja a +50 pont badge-et
- A meglévő szavazások (none opció nélkül) változatlanul működnek

**Dependencies:** Iteration F12 (szavazórendszer), F15 (admin), Backend Iteration 17

---

### Iteration F22 — Játékosok: Álomcsapat Drag-and-Drop

**Status:** DONE

**Goal:** Új feature: a felhasználó összeállíthatja saját álomcsapatát egy drag-and-drop felületen. Egy SVG focipálya alapformációval (4-2-3-1), formáció választóval (4-3-3, 4-2-3-1, 3-5-2, 4-4-2), pozíció-alapú slot validációval. A backend menti az álomcsapatot user-hez kötve. Mobilon tap-to-select fallback.

**Backend dependency:** Backend Iteration 19 (dream team perzisztencia)

**Tasks:**

- [x] F22.1 `@dnd-kit/core` telepítés és konfigurálás:
  - `npm install @dnd-kit/core @dnd-kit/sortable`
  - `DndContext` provider beállítása az álomcsapat oldalon
  - `useDroppable` és `useDraggable` hook-ok használata
- [x] F22.2 Álomcsapat oldal route (`src/app/jatekosok/almomcsapat/page.tsx`):
  - Auth guard: csak bejelentkezett user (egyébként redirect login-ra)
  - Layout: bal oldalon játékos lista (összes FC Barcelona játékos kategorizálva), közepén/jobb oldalon a focipálya
- [x] F22.3 SVG focipálya komponens (`src/components/dream-team/PitchSVG.tsx`):
  - Sematikus focipálya rajz (vonalak, középkör, büntetőterületek)
  - Formációhoz konfigurálható slot pozíciók: minden slot egy droppable terület koordinátával
  - 4-2-3-1 alapformáció default slot pozíciókkal
- [x] F22.4 Formáció választó komponens (`src/components/dream-team/FormationSelector.tsx`):
  - Pill gombok: 4-3-3, 4-2-3-1, 3-5-2, 4-4-2
  - Kattintásra a pálya slot pozíciói újrarendeződnek (Framer Motion layout animation)
  - Ha az új formációban kevesebb slot van mint amennyi player el van helyezve, a "felesleges" játékosok visszakerülnek a játékos listára
- [x] F22.5 Játékos lista panel (`src/components/dream-team/PlayerPool.tsx`):
  - Pozíció szerinti szűrő (Kapus, Védő, Középpályás, Támadó)
  - Játékos kártyák kis méretben: kép, név, pozíció, mezszám
  - Draggable elemek (`useDraggable`)
  - Már a pályán lévő játékosok halványabban vagy elrejtve
- [x] F22.6 Pozíció-alapú slot validáció:
  - Minden slot tartozik egy "elfogadott pozíció" listához (pl. GK slot csak Goalkeeper-t fogad, CB slot Defender-t)
  - Drop esemény: ha nem egyezik a pozíció, a drop visszaugrik (vagy figyelmeztető toast)
  - Vizuális visszajelzés drag közben: a kompatibilis slotok zöld highlight, inkompatibilisek piros
- [x] F22.7 Backend integráció:
  - Oldal mount: `GET /api/dream-team` lekérdezés, ha létezik álomcsapat, betöltés
  - "Mentés" gomb: `POST /api/dream-team` (új) vagy `PUT /api/dream-team/[id]` (meglévő)
  - "Új álomcsapat" gomb: alaphelyzetbe állítás
  - "Törlés" gomb: `DELETE /api/dream-team/[id]` megerősítő modal-lal
  - Toast értesítés mentés sikeres / hiba esetén
- [x] F22.8 Mobil tap-to-select fallback:
  - Mobil viewen (`useMediaQuery('(max-width: 768px)')`) drag-and-drop helyett tap-to-select
  - 1. tap: játékos kiválasztás (highlight)
  - 2. tap egy slotra: játékos elhelyezése
  - "Eltávolítás" gomb minden elhelyezett játékosnál
- [x] F22.9 Navigáció hozzáadása:
  - A `/jatekosok` oldalon link/gomb az álomcsapat-szerkesztőre
  - A profil oldalon "Álomcsapatom" link/tab

**Acceptance Criteria:**

- A user el tudja húzni a játékosokat a pálya slotjaira (desktop)
- Mobilon tap-to-select működik
- A formáció választó natívan átrendezi a pályát animációval
- A pozíció validáció megakadályozza a rossz slot elhelyezéseket
- Mentéskor az állapot perzisztens (visszatöltés a backend-ből)
- A user csak a saját álomcsapatát látja és szerkeszti

**Dependencies:** Iteration F7 (játékos lista), F4 (auth), Backend Iteration 19

---

### Iteration F23 — Közösségi Oldal: 3 Oszlopos Layout & DM UI

**Status:** DONE

**Goal:** A közösségi oldal teljes layout átalakítása 3 oszlopos struktúrára (bal navigáció, közép feed, jobb sáv: online userek + aktív szavazások widget). Új DM oldal Supabase Realtime-mal a privát üzenetküldéshez. A követés rendszer egyszerű: csak követett userre indítható DM.

**Backend dependency:** Backend Iteration 18 (DM & follow system)

**Tasks:**

- [x] F23.1 Közösségi oldal 3 oszlopos layout (`src/app/kozosseg/page.tsx`):
  - Desktop: 3 oszlop CSS Grid (`12rem | 1fr | 18rem` vagy hasonló arány)
  - Bal oszlop: közösségi navigáció (Feed, Üzenetek, Követőim) — sticky
  - Közép oszlop: a meglévő poszt feed (max 600px szélesség, mint Twitter)
  - Jobb oszlop: 2 widget — "Online userek" + "Aktív szavazások" — sticky
  - Mobil: a közép oszlop teljes szélességben, a navigáció a bottom tab bar-ban már elérhető, a jobb sáv elérhető swipe vagy "Felfedezés" tab-on
- [x] F23.2 "Online userek" widget (`src/components/social/OnlineUsersWidget.tsx`):
  - Supabase Realtime presence channel az online jelzéshez
  - Top 10 online user (avatar + username), sticky a jobb oszlopban
  - Kattintásra: a user profil oldala vagy DM indítás (ha követi)
  - "Több online" link a teljes online lista oldalra
- [x] F23.3 "Aktív szavazások" widget (`src/components/social/ActivePollsWidget.tsx`):
  - Top 3 aktív szavazás kártyája (kérdés + szavazat-szám)
  - "Mind" link a `/szavazasok` oldalra
  - Kattintás egy szavazásra: a teljes szavazó UI (a meglévő F12.2 felület)
- [x] F23.4 DM oldal route (`src/app/kozosseg/uzenetek/page.tsx`):
  - Auth guard
  - Layout: 2 oszlopos (desktop) — bal: beszélgetés lista, jobb: aktív chat view
  - Mobil: fullscreen chat view, vissza gomb a beszélgetés listára
- [x] F23.5 Beszélgetés lista komponens (`src/components/social/messaging/ConversationList.tsx`):
  - `GET /api/conversations` lekérdezés
  - Lista: minden beszélgetés egy sor — partner avatar, username, utolsó üzenet előnézet (max 50 karakter), olvasatlan üzenetek száma badge, last_message_at relatív időben ("5 perce")
  - Kattintásra: a chat view megnyitása a kiválasztott beszélgetéssel
  - Üres állapot: "Még nincsenek beszélgetéseid" + "Új üzenet" gomb
- [x] F23.6 Chat view komponens (`src/components/social/messaging/ChatView.tsx`):
  - `GET /api/conversations/[id]/messages` lekérdezés
  - Üzenetek megjelenítése: chat buborékok, saját üzenetek jobbra (kék), partner üzenetei balra (szürke)
  - Auto-scroll a legalsó üzenetre, scroll up infinite scroll régebbi üzenetek betöltéséhez
  - Üzenet input mező alul + "Küldés" gomb (Enter is)
  - `POST /api/conversations/[id]/messages` küldés, optimista frissítés (UI-ba azonnal hozzáadás, hibánál visszavonás)
  - `PUT /api/conversations/[id]/read` hívás belépéskor (olvasottra állítás)
- [x] F23.7 Supabase Realtime subscription:
  - A chat view mount-kor subscribe a `messages` táblára szűrve a `conversation_id`-ra
  - Új üzenet event esetén: hozzáadás a chat view-hoz (smooth scroll, fade-in animáció)
  - A beszélgetés listán is realtime: új üzenet esetén az adott beszélgetés sora frissül (last_message_at + olvasatlan badge)
  - Unmount-kor unsubscribe
- [x] F23.8 User kereső új DM indításához (`src/components/social/messaging/UserSearchModal.tsx`):
  - "Új üzenet" gomb a beszélgetés lista tetején → modal nyílik
  - Search input: `GET /api/users/search?q=...` (csak követett userek között keres)
  - Találatok lista: avatar + username + "Üzenet" gomb
  - "Üzenet" kattintás: `POST /api/conversations` (idempotens — ha létezik, visszaadja) → chat view nyitás
- [x] F23.9 Követés UI a profil oldalon:
  - A user profil oldalán (`src/app/profil/[id]/page.tsx` vagy a mások profil view) "Követés" / "Kikövetés" gomb
  - Toggle logika a `POST/DELETE /api/users/[id]/follow` endpointokkal
  - Followers / following count megjelenítése
  - Saját profilon nincs gomb
- [x] F23.10 Mobil DM UX:
  - A `/kozosseg/uzenetek` mobilon fullscreen
  - Két állapot: lista nézet (default) vagy chat view (ha kiválasztva)
  - Vissza gomb a chat view-ban a listára navigál
  - A bottom tab bar-on belül marad (vagy kis "vissza" gomb a tetején)

**Acceptance Criteria:**

- A közösségi oldal 3 oszlopos layout-ot mutat desktopon
- Az "Online userek" és "Aktív szavazások" widgetek élnek
- A `/kozosseg/uzenetek` DM oldal működik
- A beszélgetések listája és a chat view valós idejű frissítést kap (Supabase Realtime)
- DM csak követett user részére indítható
- Mobil DM fullscreen és intuitív
- A követés gomb a profil oldalon működik

**Dependencies:** Iteration F11 (közösségi feed), F12 (szavazások), F4 (auth), Backend Iteration 18

---

### Iteration F24 — Bug Fix: Shop Értékelés Megjelenítés, Online Szurkolók Widget, Követés UI, Játékos Stat Display

**Status:** DONE

**Goal:** A manuális tesztelés során feltárt 4 frontend hiba és hiányzó UI elem kijavítása: webshop termék kártyán az értékelés nem jelenik meg, online szurkolók widget random számot mutat, a követés funkció nem elérhető a felhasználói felületen, és a játékos statisztikák 0-0-0-0 állapota UX javítás.

**Backend dependency:** Backend Iteration 20 (játékos stat szinkron fix)

**Tasks:**

- [x] F24.1 Shop termék értékelés javítása: `src/lib/shop-api.ts`-ben a `ProductListResponse.products` típusa `Product[]`-ről `ProductWithRating[]`-re (`Product & { average_rating: number | null; review_count: number }`); `src/components/shop/ProductGrid.tsx`-ben az `average_rating` és `review_count` mezők átadása a kártyának (`averageRating={p.average_rating ?? 0}`, `reviewCount={p.review_count}`) a külső `ratings?` map prop helyett
- [x] F24.2 Online szurkolók widget valós adatra cserélése: `src/components/social/CommunityRightRail.tsx`-ben az `OnlineNowCard` komponens véletlen `seed` szám törlése; Supabase Realtime Presence channel implementálása (`community:online` channel, `track({ user_id, since })` a SUBSCRIBED eventnél, `presenceState()` méretéből valós online szám kiszámítása); cleanup unmounton (`untrack()` + `removeChannel()`)
- [x] F24.3 Követés gomb hozzáadása a feedhez: `src/components/social/PostCard.tsx`-ben a poszt szerzőjének nevére/avatar-jára kattintás már link a profilra — emellett kompakt `FollowButton size="sm"` gomb hozzáadása a szerző mellé (csak ha nem saját poszt és még nem követett); `src/components/social/CommunityRightRail.tsx`-ben "Javasolt szurkolók" blokk hozzáadása: 3-5 nem-követett profil listázása a `profiles` táblából, mindegyik mellett `FollowButton`
- [x] F24.4 Játékos statisztika „nincs adat" UI: `src/components/players/PlayerStatGrid.tsx` és `PlayerStatRadar.tsx` komponensekben ha az összes stat értéke 0 vagy undefined, "Statisztikák hamarosan" / "Feltöltés alatt" üzenet jelenjen meg 0-0-0-0 helyett; ez UX javítás — a tényleges adatjavítás a Backend Iteration 20 feladata

**Acceptance Criteria:**

- A webshop termék kártyákon az átlagos csillagértékelés helyesen jelenik meg (nem 0)
- Az online szurkolók száma valós Supabase Presence adaton alapul, nem véletlen számon
- A felhasználók a feedből egyszerűen tudnak másokat követni a FollowButton-nal
- A játékos kártyákon 0-0-0-0 helyett informatív "feltöltés alatt" üzenet látható ha nincs stat

**Dependencies:** F7 (játékos lista), F4 (auth), F23 (közösségi oldal), Backend Iteration 20

---

### Iteration F25 — Bug Fix: Profil Név, Követés Gomb, User Posztolás UI & DM Követés

**Status:** DONE

**Goal:** A közösségi modul frontend hibáinak javítása: a feed kártyákon a poszt szerzőjének neve nem jelenik meg másik bejelentkezett user nézetében, a követés gomb 404-es hibával fut, a userek nem tudnak posztot írni a feed UI-ban (csak adminok), és a DM oldalon hiányzik a követés/kikövetés gomb a beszélgetéshez tartozó partnerre.

**Backend dependency:** Backend Iteration 21 (követés/profil/posztolás/DM follow backend fixek)

**Tasks:**

- [x] F25.1 Feed poszt szerző név megjelenítés fix: `src/components/social/PostCard.tsx` (és az adott `FeedCard` ha külön komponens) komponensben az author username helyes forrásból töltődik (a backend response `author.username` mezőjéből, nem `post.user.username` vagy hibás kulcsból); a Supabase query / fetch hook (`src/lib/community-api.ts` vagy hasonló) is használja a backend response shape-ét (`author: { id, username, avatar_url }`); fallback "Ismeretlen szurkoló" ha az author hiányzik; az avatar src is konzisztensen tölt; mind a feed listán, mind a poszt detail view-ban
- [x] F25.2 Követés gomb javítása a közösségi oldalon: `src/components/social/FollowButton.tsx` (vagy ahol a follow logika van) — a target user ID a helyes forrásból jön (a `post.author.id`, nem `post.id`!); error handling: ha a backend 404-et vagy 400-at ad, értelmes toast üzenet ("Ez a felhasználó nem található" / "Érvénytelen kérés") sonner toast-on át; loading state a kattintás alatt; optimista UI frissítés (gomb azonnal "Követed"-re vált, hibánál visszavon); a `CommunityRightRail` "Javasolt szurkolók" listán is ugyanaz a komponens használata
- [x] F25.3 Feed poszt létrehozás UI usereknek: új `src/components/social/CreatePostForm.tsx` komponens — content textarea (max 2000 karakter karakter-számlálóval), opcionális image upload (drag-and-drop vagy file picker, kép preview), "Közzététel" gomb; `POST /api/posts` hívás; a komponens a `/kozosseg` feed oldal tetején jelenjen meg minden bejelentkezett user számára (nem csak admin); siker után optimista frissítés a feed listán (új poszt a tetejére); az admin nézetben a meglévő admin posztoló UI továbbra is elérhető (kettős kompatibilitás); validáció zod-dal, react-hook-form integrálással a meglévő stack szerint
- [x] F25.4 DM oldal követés gomb integráció: `src/components/social/messaging/ConversationList.tsx` minden beszélgetés sorához kompakt `FollowButton size="sm"` hozzáadása a partner mellé (a `is_following` mező alapján a `GET /api/conversations` response-ból); `src/components/social/messaging/ChatView.tsx` headerébe (partner avatar + username mellé) is "Követés" / "Követed" gomb; a meglévő FollowButton komponens újrahasznosítása (F25.2-vel közös); siker után a `is_following` állapot frissül lokálisan (nem kell teljes refetch); ha a bejelentkezett user kikövet egy partnert, a DM küldési input letiltása vagy figyelmeztetés ("Csak követett felhasználóval írhatsz") — a backend modell szerint

**Acceptance Criteria:**

- A feed kártyákon minden poszt szerzőjének neve és avatarja helyesen jelenik meg másik user nézetében is
- A követés gomb a feedben sikeresen követ/kikövet, 404-es hiba esetén értelmes hibaüzenet
- Bejelentkezett user (nem admin) tud új posztot létrehozni a `/kozosseg` oldalon szöveggel és opcionális képpel
- Az admin posztoló UI továbbra is működik (regresszió-mentes)
- A DM oldalon (lista + chat header) követés gomb látható és működik
- Optimista UI frissítések minden follow/unfollow akciónál
- A user nem tud üzenetet küldeni nem-követett partnernek (UI gátol)

**Dependencies:** F11 (közösségi feed), F23 (DM UI), F4 (auth), Backend Iteration 21

---

### Iteration F26 — Közösségi Bug Fix: Scroll Jump, Profil 404, Follow UI, Komment Nevek, Javasolt Widget

**Status:** DONE

**Goal:** A közösségi modul frontend hibáinak javítása + follow jóváhagyás UI + scroll stabilizálás.

**Backend dependency:** Backend Iteration 22 — TODO

**Tasks:**

- [x] F26.1 Közösségi feed — Follow gomb eltávolítása — PostCard és komment sorok NEM tartalmaznak Follow gombot; a FollowButton komponens csak az Üzenetek felületen jelenik meg
- [x] F26.2 `/profil/[id]` publikus profil oldal — Next.js `src/app/profil/[id]/page.tsx` létrehozása; betölti a `GET /api/users/[id]/profile` adatokat; megjelenít: avatar, username, csatlakozás dátuma, user posztjai; 404 handling ha nincs ilyen user
- [x] F26.3 Polling scroll jump javítás — a 3 másodpercenkénti feed frissítés ne ugorjon; megoldás: az új posztok nem scrollnak, hanem egy "X új bejegyzés — kattints a frissítéshez" toast/banner jelenik meg felül; vagy: `useRef` + scroll pozíció visszaállítás a DOM frissítés után
- [x] F26.4 Follow gomb állapotok — három állapot: `not_following` (Követés gomb), `pending` (Kérelem elküldve — disabled), `following` (Követed — kikövetés); Framer Motion állapot-animáció a váltáshoz
- [x] F26.5 Follow kérelmek kezelő UI — az Üzenetek oldalon beérkező kérelmek szekció: lista a pending kérelmekről (avatar, username, Elfogad / Elutasít gombok); `GET /api/follow-requests` hívás; badge az Üzenetek nav ikonon ha van pending kérelem
- [x] F26.6 Javasolt Szurkolók widget javítás — `GET /api/users/suggested` hívás; valódi "még nem követett" userek megjelenítése; minden kártya: avatar, username, Követés gomb (az F26.4-es állapotokkal)
- [x] F26.7 Üzenetek keresés fix — a keresőmező `GET /api/users/search?q=...` hívással az összes usert keresi; találatokon: avatar, username, "Követés kérése" gomb ha `not_following`, "Kérelem elküldve" ha `pending`, "Üzenet" gomb ha `following`
- [x] F26.8 Komment username megjelenítés — a kommenteknél `comment.author.username` töltődik be; fallback "Ismeretlen szurkoló"; iniciales avatar ha nincs kép

**Acceptance Criteria:**

- A közösségi feed PostCard-ján és komment sorain nincs Follow gomb; a FollowButton csak az Üzenetek felületen él
- A `/profil/[id]` publikus profil oldal sikeresen tölt és megjeleníti a user adatait + posztjait, érvénytelen ID-re 404 oldal
- A 3 mp-es polling nem ugrasztja a scrollt; az új tartalom toast/banner formában jelenik meg vagy a scroll pozíció megőrzött
- A Follow gomb mindhárom állapotban (not_following / pending / following) helyesen viselkedik animált átmenettel
- Az Üzenetek oldalon megjelennek a beérkező follow kérelmek, elfogadás/elutasítás működik, badge mutatja a pending darabszámot
- A "Javasolt Szurkolók" widget valódi suggested usereket jelenít meg, nem random/követett listát
- Az Üzenetek keresés az összes user között keres és a státusznak megfelelő gombot mutat (Követés kérése / Kérelem elküldve / Üzenet)
- A kommenteknél a szerző neve és avatarja konzisztensen jelenik meg, fallback működik

**Dependencies:** F11 (közösségi feed), F23 (DM UI), F25 (közösségi bug-fix előzmény), Backend Iteration 22

---

### Iteration F27 — Bug Fix: Landing Page, Hover Effektek, Glass Felugró Ablakok, /jegyek Logika, Álomcsapat Drag, Admin Játékos Kép & Admin Kupon UI

**Status:** DONE

**Goal:** A felhasználói tesztelés során feltárt frontend hibák és UX problémák kijavítása: landing page szekció hibák, hover effektek hozzáadása, modális ablakok glass stílusra cserélése, /jegyek oldal jegyvásárlás státusz logika javítása, álomcsapat drag-and-drop hibák, admin játékos szerkesztőben kép-eltávolítás gomb, admin kupon oldal kibővítése statisztika megjelenítéssel és törlő gombbal.

**Backend dependency:** Backend Iteration 23 (Supabase warningok, kupon stat & hard delete, játékos kép remove backend) — DONE (2026-05-02), F27 most teljes körűen indítható

**Tasks:**

- [x] F27.1 Landing page szekció javítások (errors.md 1. pont):
  - A landing page (`src/app/page.tsx` és kapcsolódó szekció komponensek) átnézése, a hibás vagy törött szekciók javítása
  - Konkrét javítandó szekciók (errors.md alapján): hero rész igazítás, scroll-triggered szekciók indítási pont, mobile breakpoint hibák, esetleg törött kép referenciák vagy elrontott animáció timing
  - GSAP ScrollTrigger újrakalibrálás ha a player carousel szakad
  - Mobile-on a folytonos háttér valóban folytonos (nincs accidental szekció-tördelés)

- [x] F27.2 Hover effektek hozzáadása (errors.md 2. pont):
  - A liquid glass design system szerint minden interaktív elem (kártya, gomb, link) konzisztens hover effektet kapjon: glass glow, enyhe scale (1.02), border fényesedés
  - Konkrét érintett komponensek: cikk kártyák, termék kártyák, játékos kártyák (a flip animáción túl), poll kártyák, social poszt kártyák, dashboard widgetek
  - A `.glass-card-hover` utility class konzisztens alkalmazása mindenhol ahol a hover állapot eddig hiányzott
  - Mobil: a hover effektek `@media (hover: hover)` mögé mozgatva, hogy ne ragadjon be touch eszközön

- [x] F27.3 Felugró ablakok glass stílusra cserélése (errors.md 3. pont):
  - Minden modal / dialog / dropdown / popover komponens átnézése, és a liquid glass design system-hez igazítása
  - Konkrét érintett komponensek: kosár modal, jegy szektor választó modal, login/regisztráció modal (ha modal), szavazás megerősítő modal, kupon beváltás megerősítő modal, admin dialog-ok, user kereső modal (DM), follow request modal
  - shadcn/ui Dialog komponens: `backdrop-blur`, semi-transparent overlay, glass-card kontent, finom border, shadow-glow
  - Konzisztens dark/light variánsok minden modálon

- [x] F27.4 /jegyek "Jegyvásárlás elérhető" logika javítása (errors.md 4. pont):
  - `src/app/jegyek/page.tsx` és kapcsolódó meccs lista komponens átnézése
  - A jelenlegi logika: minden meccs alatt "Jegyvásárlás hamarosan" üzenet jelenik meg akkor is, amikor az admin már generálta a szektorokat
  - Új logika: a meccshez tartozó `match_sectors` lekérdezésével (vagy a `GET /api/matches/[id]` válaszának `sectors` mezője alapján) a komponens eldönti: ha **vannak szektorok az adatbázisban** a meccshez (legalább 1 sector ahol `total_seats > 0`), akkor "Jegyvásárlás elérhető" + "Jegyek" CTA jelenik meg; ha **nincsenek szektorok**, "Jegyvásárlás hamarosan" maradjon
  - Frontend-only fix — backend változás nincs, mert az admin "Szektorok újragenerálása" gomb már létrehozza a szektorokat
  - Loading state: amíg a szektorok lekérdezése fut, skeleton/loading megjelenítés

- [x] F27.5 Álomcsapat drag-and-drop javítás (errors.md 5. pont):
  - `src/app/almomcsapat/page.tsx` (vagy ahol az álomcsapat UI van) és a drag komponens átnézése
  - Konkrét hibák a drag flow-ban: a játékos kártyák nem dobhatók a megfelelő pozíció slotokba, vagy a drop zóna touch-on nem reagál, vagy a csere logika nem működik (két játékos cserélésekor egyik eltűnik)
  - dnd-kit (vagy az aktuálisan használt drag könyvtár) konfigurációjának javítása
  - Mobil touch support: `TouchSensor` aktivválása, megfelelő delay/tolerance beállítás
  - A drag közben vizuális visszajelzés (drag overlay, drop zone highlight)
  - A mentés (`POST /api/dream-team` vagy `PUT /api/dream-team/[id]`) a javítás után konzisztensen működik

- [x] F27.6 Admin játékos kép eltávolítás gomb (errors.md 6. pont — frontend rész):
  - `src/app/admin/jatekosok/[id]/page.tsx` (vagy az admin játékos szerkesztő komponens) átnézése
  - Új "Kép eltávolítása" gomb hozzáadása a kép preview mellé (csak akkor látható ha a játékosnak már van képe)
  - Gomb kattintásra megerősítő dialog (glass stílusú) → "Biztosan eltávolítod?" → Igen/Nem
  - Igen esetén: `PUT /api/admin/players/[id]` hívás `removeImage=true` form mezővel (a Backend Iteration 23.4 új flag-jét használva)
  - Sikeres válasz után: a UI kép preview-t default placeholder-re cseréli, toast "A kép eltávolítva"
  - Hiba esetén: toast hibaüzenet, gomb újra aktív
  - A meglévő kép-feltöltés flow változatlan marad (regression-mentes)

- [x] F27.7 Admin kupon oldal kibővítés (errors.md 7. pont — frontend rész):
  - `src/app/admin/kuponok/page.tsx` (vagy az admin kupon lista / szerkesztő komponens) átnézése
  - **Statisztika megjelenítés:** minden kupon kártyán/sorban két új mező megjelenítése: "Beváltva: X" és "Felhasználva: Y" (a `GET /api/admin/coupons/[id]/stats` endpointról vagy a kibővített listázó válaszból)
  - **Inaktívvá tevő gomb (meglévő):** változatlan, "Inaktiválás" felirattal — soft delete (`DELETE /api/admin/coupons/[id]`)
  - **Új törlő gomb:** "Végleges törlés" felirat, piros / destructive variáns, csak admin
  - Törlő gomb kattintásra **kétlépcsős megerősítő dialog**:
    - 1. lépés: "Biztosan véglegesen törlöd? Ez visszafordíthatatlan."
    - 2. lépés (ha a stat alapján volt beváltás): figyelmeztetés "X felhasználó beváltott kupon érintett — ezek az adatbázisból eltűnnek!" → újabb megerősítés
  - Megerősítés után: `DELETE /api/admin/coupons/[id]/hard` hívás (Backend Iteration 23.3-as endpoint)
  - Sikeres válasz után: a kupon eltűnik a listából (optimista frissítés), toast "Kupon véglegesen törölve"
  - Hiba esetén: toast hibaüzenet
  - A két gomb világosan megkülönböztethető: az inaktiválás semleges variáns, a végleges törlés destructive piros variáns

**Acceptance Criteria:**

- A landing page szekciói hibátlanul renderelődnek desktopon és mobilon, az animációk (GSAP, Framer Motion) elindulnak
- Minden interaktív elem (kártya, gomb, link) konzisztens glass hover effektet mutat hover-képes eszközön
- Az összes modal / dialog / popover liquid glass stílusú (backdrop-blur, semi-transparent, finom border, shadow-glow), dark/light módban egyaránt
- A /jegyek oldalon a "Jegyvásárlás elérhető" csak akkor jelenik meg ha a meccshez tartozó szektorok léteznek az adatbázisban; egyéb esetben "Jegyvásárlás hamarosan"
- Az álomcsapat drag-and-drop hibátlanul működik desktop egéren és mobil touch-on, a játékosok cserélhetők és menthetők
- Az admin játékos szerkesztőben "Kép eltávolítása" gomb látható ha a játékosnak van képe; megerősítés után a kép eltávolítódik (a Backend 23.4 endpoint hívásával)
- Az admin kupon listán minden kupon mellett megjelenik a beváltási és felhasználási statisztika
- Az admin kupon oldalon megmaradt az inaktiválás gomb (soft delete) ÉS megjelent egy új "Végleges törlés" gomb (hard delete) kétlépcsős megerősítéssel
- Optimista UI frissítések minden új gomb akciónál (kép-eltávolítás, hard delete)

**Dependencies:** F1 (design system), F8 (jegyek), F19 (admin panel), F22 (álomcsapat), F26 (közösségi UI), Backend Iteration 23

---
