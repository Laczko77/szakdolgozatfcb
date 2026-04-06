# BarcaPulse – Claude Code Frontend Implementation Prompts
> Ezek a promptok a `frontend-design` skill alapján lettek megírva.
> Minden prompt egyetlen Next.js page/component-et valósít meg.
> Sorrend: hajtsd végre őket egymás után, az előző képernyők CSS-változóit és komponenseit újrafelhasználva.
---
## 🎨 GLOBÁLIS DESIGN RENDSZER (Minden prompthoz)
```
BRAND: BarcaPulse
AESTHETIC: Luxury sports editorial — brutalist precision meets premium football magazine
TECH STACK: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
CSS VARIABLES (globals.css-be):
  --bg-base: #1D1A31
  --bg-card: #252240
  --bg-element: #2E2B4A
  --border: rgba(255,255,255,0.07)
  --fcb-blue: #004D98
  --fcb-crimson: #A50044
  --fcb-gold: #EDBB00
  --text-primary: #F5F0FF
  --text-secondary: #9B97B8
TYPOGRAPHY (Google Fonts + next/font):
  - Bebas Neue → minden h1/h2/display/nagy szám
  - DM Sans → body text, UI labels, leírások
  - Space Mono → kis uppercase labelek, statisztikák, metaadatok
FORBIDDEN: Inter, Roboto, Arial, system-ui, Space Grotesk
DESIGN RULES:
  - border-radius: 0px MINDENHOL (gombok, kártyák, inputok)
  - Noise grain texture overlay: minden section/page-en (svg feTurbulence vagy CSS)
  - Aszimmetrikus layoutok: ne centeren, hanem left-aligned editorial
  - Animáció: staggered reveal belépéskor + hover glow hatások
```
---
## PROMPT 1 — Landing Page (`/`)
**File:** `app/page.tsx`
```
Valósítsd meg a BarcaPulse landing page-ét Next.js 14 App Router-rel, TypeScript-tel és Tailwind CSS-sel.
DESIGN RENDSZER:
- Háttér: #1D1A31 (CSS grain texture SVG overlay 4% opacity-vel)
- Bebas Neue display font, DM Sans body, Space Mono labels
- Minden elem: 0px border-radius
- Animációk: framer-motion vagy CSS @keyframes staggered reveal
NAVBAR (komponens: components/Navbar.tsx):
- 64px height, position: fixed, z-50
- Átlátszó hero felett, scrollra: bg #1D1A31 + 1px bottom border rgba(255,255,255,0.06) jelenik meg
- Bal: "/" slash ikon (kék+piros CSS elem) + "BARCAPULSE" wordmark Bebas Neue 22px fehér, letter-spacing 4px
- Jobb: "Bejelentkezés" link #9B97B8 + "Regisztráció →" fehér, nyílnál 2px crimson underline
HERO SECTION (100vh):
- NEM középre igazított — aszimmetrikus 2 hasábos elrendezés
- Háttér: #1D1A31 + lebegő gradient mesh (kék #004D98 bal-fent, bordó #A50044 jobb-lent, blurred radial-gradient, 60% opacity) + noise grain overlay
- Bal (60%): vertikálisan középre igazított blokk
  - Space Mono 11px arany, letter-spacing 6px: "FC BARCELONA · RAJONGÓI PLATFORM"
  - Bebas Neue 96px fehér 2 sor: "BARÇA ÉL" (első sor) + "BENNED" (második sor 80px indent-tel — diagonal rhythm)
  - DM Sans 18px #9B97B8 leírás
  - Két gomb 20px gap-pel: "Regisztrálj ingyen" (#A50044 fill, square) + "Bejelentkezés" (outline, square)
- Jobb (40%): "1899" Bebas Neue 200px arany 8% opacity, döntötten (15°), részben vágva
- Jobb-alsó sarok: 15°-os diagonal 1px vonalak rács (rgba(255,255,255,0.08))
STAT MARQUEE SECTION:
- #252240 bg, diagonal clip-path felső éle (CSS: clip-path: polygon)
- Vízszintes marquee CSS animáció: "1899 — ALAPÍTVA · 125+ TRÓFEA · MÉS QUE UN CLUB · 5× BAJNOKOK LIGÁJA ·"
- Bebas Neue 24px arany, letter-spacing 3px, infinite scroll
MIÉRT BARCAPULSE? SECTION:
- "MIÉRT BARCAPULSE?" Bebas Neue 64px jobbra eltolva (ml-32 vagy translate)
- 2px bordó bal oldali dekoratív vonal, teljes magasságon
- DM Sans paragrafus #9B97B8
FEATURE KÁRTYÁK (4 db):
- Nem sima 2x2 grid: enyhe rotáció váltakozva (-0.5° / +0.5°) minden kártyán
- #252240 bg, 0px radius, 1px rgba(255,255,255,0.08) border
- Arany Lucide ikon 32px + Bebas Neue 24px cím + DM Sans 14px leírás
- Jobb felső sarokban: 24×24px-es #A50044 négyzet (absolute positioned)
CTA BANNER:
- Full-bleed, #A50044 bg + noise grain texture
- Bebas Neue 56px fehér "CSATLAKOZZ MÁR MA." bal-igazítva
- Jobb oldal: "Regisztrálj →" nagy fehér link
- A banner felett: teljes szélességű 1px arany vonal
FOOTER:
- #1D1A31 bg, 1px top border rgba(255,255,255,0.06)
- Bal: Space Mono 12px arany "BARCAPULSE" letter-spacing 3px
- Jobb: DM Sans 11px #9B97B8 disclaimer
```
---
## PROMPT 2 — Bejelentkezés (`/login`)
**File:** `app/(auth)/login/page.tsx`
```
Valósítsd meg a BarcaPulse login oldalát Next.js 14-ben. A globális design rendszer (0px radius, Bebas Neue, #1D1A31) érvényes. Supabase auth-t szimulálj vagy illeszd be.
LAYOUT: Osztott képernyő (split-screen), flex row, 100vh
- Bal 45%: Dekoratív panel (#252240 bg)
  - "BARCA" szöveg Bebas Neue 160px, arany 6% opacity, döntött (15°) háttér texturaként
  - Középen lent: 3 vékony horizontal vörös csík + "BARCAPULSE" wordmark Space Mono 12px arany
  - Opcionális: lassú gradient mesh animáció CSS keyframes-szel
- Jobb 55%: Form terület, vertikálisan középre igazítva, 40px bal padding
FORM (lebegve, nincs kártyakeret):
- "BARCAPULSE" Bebas Neue 14px arany letter-spacing 6px (márka-visszaigazolás)
- "Bejelentkezés" Bebas Neue 48px #F5F0FF, bal-igazítva
- 1px arany vonal, 40px széles, cím alatt
- Input stílus (MINDEN mezőn): 52px height, #2E2B4A bg, 0px radius, CSAK alsó 1px kék (#004D98) border — underline stílus, NEM full-border box; fehér DM Sans szöveg; fókuszban: arany bottom border + enyhe kék bal glow
- "EMAIL CÍM" Space Mono 11px #9B97B8 label → input
- "JELSZÓ" label → input szem-toggle iconnal (DM Sans 14px)
- "Elfelejtetted?" 12px DM Sans arany, jobbra igazítva
- Submit: teljes szélességű, 52px, #A50044 fill, 0px radius, Bebas Neue 20px letter-spacing 2px "BEJELENTKEZÉS"; hover: #004D98 fill transition
- Lent: "Még nincs fiókod? REGISZTRÁLJ →" DM Sans 13px #9B97B8 + arany link
HIBAKEZELÉS: Input underline pirossá válik + Space Mono 11px piros (#EF4444) szöveg alatta — NEM piros box/alert
```
---
## PROMPT 3 — Regisztráció (`/register`)
**File:** `app/(auth)/register/page.tsx`
```
Valósítsd meg a BarcaPulse regisztrációs oldalát. Ugyanaz a split-screen layout mint a login, de erősebb bordó jelenléttel.
LAYOUT: Azonos mint login.
- Bal panel: bordó-domináns gradient (#A50044 → #1D1A31), "1899" Bebas Neue 180px 5% opacity, lent "LEGACY CONTINUES" Space Mono 11px arany
- Jobb: lebegő form, azonos stílus
FORM:
- Cím: "Csatlakozz" Bebas Neue 48px + "hozzánk." enyhén bordóval árnyalt (color-mix vagy single tint)
- Alcím: DM Sans 14px #9B97B8
- 4 mező (all underline-style, 20px vertical gap):
  1. "TELJES NÉV *" — Space Mono label + underline input
  2. "EMAIL CÍM *" — ugyanígy
  3. "JELSZÓ *" — szem-toggle + "min. 6 karakter" hint Space Mono 11px #9B97B8 alatt
  4. "BECENÉV" — "(OPCIONÁLIS)" Space Mono 10px arany suffix a label mellett
- Submit: "REGISZTRÁLJ INGYEN →" Bebas Neue, #004D98 kék fill (különbözik logintól!), square, 52px
- Lent: "Már van fiókod? JELENTKEZZ BE →" DM Sans + arany link
HIBA: azonos inline stílus mint login
```
---
## PROMPT 4 — Dashboard főoldal (`/dashboard`)
**File:** `app/(app)/dashboard/page.tsx`
```
Valósítsd meg a hitelesített főoldal dashboardot BarcaPulse-hoz. Ez az app szíve — prémium sportmagazin digitális kiadás érzet.
Minden szekció legyen önálló komponens a components/dashboard/ mappában.
NAVBAR (Authenticated, components/NavbarAuth.tsx):
- 64px, #1D1A31 + 1px rgba(255,255,255,0.07) bottom border
- Bal: "BARCAPULSE" Bebas Neue 18px arany, letter-spacing 4px
- Közép: DM Sans 14px #9B97B8 nav linkek ponttal elválasztva; aktív: fehér + 2px arany underline
- Jobb: kosárikon bordó badge-dzsel + user initial kör (arany keret, Bebas Neue initials) + "Kilép" link
WELCOME HEADER:
- #1D1A31, 80px height; bal: "Üdvözlünk," DM Sans 16px #9B97B8 + "KOVÁCS JÁNOS" Bebas Neue 40px fehér; jobb: "/" arany + dátum Space Mono 12px
HÍREK SZEKCIÓ:
- "HÍREK" Bebas Neue 48px, bal-flush; arany vonal bal-tól halvá-ig (aszimmetrikus); "Összes hír →" jobb-fent
- 3 kártyás ASZIMMETRIKUS grid: első 50% szélességű tall, következő kettő 25%+25% egymás alatt
- Minden kártya: #252240, 0px radius; kép fölött bordó kategória badge; Bebas Neue cím; Space Mono dátum
KÖVETKEZŐ MÉRKŐZÉS:
- Teljes szélességű hero card, #252240 bg + CSS diagonal stripe animáció
- Space Mono gold label + "FC BARCELONA vs [ELLENFÉL]" Bebas Neue 36px; "VS" Bebas Neue 80px 10% opacity háttér
- "JEGYET VENNI →" kék square gomb jobbra
EREDMÉNYEK:
- "EREDMÉNYEK" Bebas Neue 36px + 3px bordó underline
- 3 vízszintes mini kártya: #2E2B4A, bal 4px border (zöld/amber/piros), Bebas Neue 32px eredmény, DM Sans csapatnév
TÁBLÁZAT KÁRTYA:
- "#1" Bebas Neue 80px arany balra + "FC BARCELONA | 72 PONT | +48 GK | W25 D5 L4" DM Sans jobban
GÓLSZERZŐK:
- 3 kártya vízszintesen, #252240 bg; Bebas Neue 120px mezszám háttér 8% opacity-val; előtér: név + statisztikák
TRÓFEÁK STRIP:
- Teljes szélességű sáv; 1px arany osztóvonalak; Bebas Neue számok aranyban; DM Sans labelek alattuk
SZAVAZÁS WIDGET:
- "AKTÍV SZAVAZÁS" Space Mono bordó label; Bebas Neue kérdés; ghost gombok (0px radius, 1px kék border); "SZAVAZZ →" arany link
```
---
## PROMPT 5 — Hírek lista (`/news`)
**File:** `app/(app)/news/page.tsx`
```
Valósítsd meg a BarcaPulse hírarchív oldalt. Stílus: prémium sportmagazin olvasási élmény.
PAGE HEADER:
- "HÍREK" Bebas Neue 96px, 20% opacity háttér szövegként + tényleges "Hírek" Bebas Neue 56px felette
- Alatta: 1px arany vonal + DM Sans 16px #9B97B8 alcím
- Breadcrumb bal-fent: Space Mono 11px #9B97B8
KATEGÓRIA SZŰRŐ:
- NEM pill gombok — szöveg linkek | elválasztóval: "ÖSSZES | MECCS | ÁTIGAZOLÁS | KLUB | INTERJÚ"
- DM Sans 13px #9B97B8 inaktív; aktív: Bebas Neue 14px arany + 2px arany underline
HÍR GRID (szerkesztői elrendezés — NEM egyforma 3 oszlop):
- 1. sor: 1 nagy kártya (60%) + 1 keskeny (40%)
- 2. sor: 3 egyenlő kártya
- 3. sor: 2 széles kártya
- Minden kártya: #252240 bg, 0px radius, hover: 2px bordó top border + enyhe liftup shadow
- Kategória badge: square, szín-kódolt (kék=meccs, bordó=átigazolás, szürke=klub), Bebas Neue 12px
- Cím: Bebas Neue 22px fehér; dátum: Space Mono 11px #9B97B8
LAPOZÓ: "← ELŐZŐ | OLDAL 2/5 | KÖVETKEZŐ →" DM Sans 13px, aranyszínű nyilak
```
---
## PROMPT 6 — Hír részlet oldal (`/news/[id]`)
**File:** `app/(app)/news/[id]/page.tsx`
```
Valósítsd meg a cikk olvasó oldalát. Stílus: prémium hosszú formátumú újságírás — tipográfia-vezérelt.
"← HÍREK" Space Mono 11px arany, top-left, navbar alatt 24px-rel (back navigáció)
CIKK KONTÉNER (max-width: 760px, mx-auto, bő padding):
CIKK FEJLÉC:
- Square kategória badge (pl. kék "#004D98" + Bebas Neue 12px fehér "MECCS")
- Cím: Bebas Neue 64px #F5F0FF, line-height 1.05 — hatalmas és szerkesztői, 2-3 sort tölt be
- DM Sans 13px #9B97B8 dátum + 1px teljes szélességű arany vonal alatta
HERO KÉP:
- Teljes cikk szélességű, 440px height, object-cover, 0px radius
- Alatta: 2px bordó accent vonal + italic DM Sans 12px #9B97B8 caption
CIKK TÖRZS:
- DM Sans 17px #F5F0FF, line-height 1.8
- Drop cap: első betű Bebas Neue 72px bordó szín, float: left, 3 sor magasságú
- Bekezdés közök: 28px
- Alcímek: Bebas Neue 32px fehér + 3px arany bal oldali border
- Idézetek (pull quotes): DM Sans 22px italic #9B97B8, 48px indent, 2px bordó bal border
"← VISSZA A HÍREKHEZ" Space Mono 12px arany, bal-igazítva, 48px bottom margin
```
---
## PROMPT 7 — Meccsek (`/matches`)
**File:** `app/(app)/matches/page.tsx`
```
Valósítsd meg a meccsek naptár oldalát. Stílus: élő sportközvetítő panel meets editorial.
PAGE HEADER:
- "MECCSEK" Bebas Neue 72px bal-igazítva, bal széltől kissé levágva (overflow-hidden hatás)
- 3px bordó underline az első szón
- DM Sans 15px #9B97B8 alcím
KÖZELGŐ MÉRKŐZÉSEK:
- "KÖZELGŐ MÉRKŐZÉSEK" Space Mono 11px arany + pulsáló bordó pont (CSS animation: pulse)
- Minden meccssor: TELJES SZÉLESSÉGŰ ROW (nem kártya), 1px bottom border
  - Bal: Bebas Neue 28px fehér nap + Space Mono 11px hónap (egymás alatt)
  - Bal-közép: "LA LIGA · CAMP NOU" Space Mono 11px #9B97B8
  - Közép: "FC BARCELONA" DM Sans 14px + "VS" Bebas Neue 32px + ellenfél
  - Jobb: kék Bebas Neue 22px idő
  - Legjobbra: "JEGYET VENNI →" kék square gomb VAGY "JEGY NEM ELÉRHETŐ" Space Mono muted
  - Hover: 1px arany bal border + #252240 bg tint
LEGUTÓBBI EREDMÉNYEK:
- "EREDMÉNYEK" Space Mono fejléc
- Azonos sor stílus — de Bebas Neue 36px eredmény zöld/amber/piros + bal 4px border + "GYŐZELEM"/"DÖNTETLEN"/"VERESÉG" Space Mono 10px jobbra
```
---
## PROMPT 8 — Jegyvásárlás (`/tickets/[matchId]`)
**File:** `app/(app)/tickets/[matchId]/page.tsx`
```
Valósítsd meg a jegyvásárló oldalt. Ez a legkomplexebb interaktív képernyő — SVG stadion térkép React state-tel.
"← MECCSEK" Space Mono 11px arany (back nav)
MECCS INFO FEJLÉC:
- #252240 section, 100px height; "FC BARCELONA vs REAL MADRID" Bebas Neue 36px középre; "2025. MÁJUS 12. · 21:00 · CAMP NOU" Space Mono 12px arany; 1px bordó full-width vonal alul
KÉT OSZLOPOS LAYOUT (58% / 42%):
BAL — SVG STADION TÉRKÉP (58%):
- #1D1A31 bg, felülnézetes stadion SVG
- Zöld focipálya középen CSS-sel, fehér vonalakkal
- 4 szvektor SVG path (onHover: fill 100% opacity + 2px fehér stroke):
  - TRIBUNA (bal): #004D98 fill 70%
  - GOL NORD (fent): #A50044 fill 70%
  - GOL SUD (lent): #D4A017 fill 70%
  - LATERAL (jobb): #0E7490 fill 70%
- Kiválasztott szektor: erős fill + 2px fehér stroke + enyhe fehér glow
- Belül Bebas Neue 16px fehér szektorfeliratok (SVG text)
- Legenda alul: 4 szín négyzet + név + ár DM Sans 13px
JOBB — TICKET SELECTOR (42%):
- Lebeg #1D1A31-en, nincs doboz keret; "JEGYVÁSÁRLÁS" Bebas Neue 32px
- Ha nincs szektor kiválasztva: "Válassz szektort a térképen" Space Mono 13px italic + arany bal nyíl
- Ha van kiválasztva (React state):
  - "KIVÁLASZTOTT SZEKTOR:" Space Mono 11px + "TRIBUNA" Bebas Neue 24px arany
  - "45 €/JEGY" DM Sans 18px + "280 SZABAD HELY" Space Mono 12px zöld dot
  - Mennyiség: "−" square button | "2" Bebas Neue 28px | "+" square button (#2E2B4A)
  - "ÖSSZESEN: 90 €" Bebas Neue 36px
  - "JEGYET VESZEK →" full-width #A50044 button, Bebas Neue 22px, 56px; hover: #004D98
SIKERES VÁSÁRLÁS MODAL:
- Dark overlay; #252240 panel 0px radius 400px; 2px arany top border; zöld "✓" Bebas Neue 80px; "SIKERES JEGYVÁSÁRLÁS!" Bebas Neue 32px; "RENDBEN" kék square gomb
```
---
## PROMPT 9 — Játékosok lista (`/players`)
**File:** `app/(app)/players/page.tsx`
```
Valósítsd meg a keretes játékos listát. Stílus: gyűjtőkártya galéria szerkesztői hierarchiával.
PAGE HEADER:
- "A CSAPAT" Bebas Neue 80px fehér bal-flush + "2024/25-ÖS SZEZON KERETE" Space Mono 12px arany, 20px behúzva jobbra (lépcsős layout)
POZÍCIÓ SZŰRŐ:
- "MIND · KAPUS · VÉDŐ · KÖZÉPPÁLYÁS · TÁMADÓ" Bebas Neue 16px szöveg nav
- Inaktív: #9B97B8; aktív: fehér + 2px arany underline; pont elválasztók
JÁTÉKOS GRID (4 oszlop, 20px gap):
Minden kártya: #252240 bg, 0px radius, 1px solid rgba(255,255,255,0.07)
- Kép terület (180px): sötét gradient (#1D1A31 → #252240), játékos fotó, bottom vignette
  - Mezszám: Bebas Neue 48px arany 25% opacity, abs top-left
  - Jobb felső: kis #252240 square + Bebas Neue 16px fehér mezszám
- Alsó rész (60px): DM Sans 14px fehér semibold név + Space Mono 11px #9B97B8 poszt
- Hover: scale(1.02), 2px bordó top border, shadow 0 12px 40px rgba(0,0,0,0.5)
```
---
## PROMPT 10 — Játékos részletoldal (`/players/[id]`)
**File:** `app/(app)/players/[id]/page.tsx`
```
Valósítsd meg a prémium játékosprofil oldalt. Stílus: atléta identitáskártya meets sportmagazin terjedelem.
"← JÁTÉKOSOK" Space Mono 11px arany (back nav)
JÁTÉKOS HERO SECTION (350px):
- Teljes szélességű, #1D1A31 alap
- Éles diagonális színosztás: bal 60% kék gradient (#004D98 → #1D1A31), jobb 40% bordó gradient (#A50044 → #1D1A31)
- Mezszám: Bebas Neue 280px fehér 8% opacity, teljes szélességű háttértextúra
- Játékos fotó: jobb-közép, 220px magasság, kilóg alul a section aljából (overflow visible)
- Bal szöveg blokk:
  - "CSATÁR" Bebas Neue 14px arany, letter-spacing 4px
  - Játékos neve Bebas Neue 72px #F5F0FF, line-height 0.9
  - 1px arány vonal, 60px széles
  - "Spanyolország · 28 éves · Mez: 9" DM Sans 14px #9B97B8
STATISZTIKA STRIP (80px, #252240):
- 5 stat vízszintesen, 1px rgba(255,255,255,0.1) osztóvonalakkal
- Érték: Bebas Neue 36px fehér (gólok: arany); label: Space Mono 10px #9B97B8
LEÍRÁS SZEKCIÓ:
- max-width 720px, mx-auto
- "JÁTÉKOSRÓL" Space Mono 12px arany label
- DM Sans 17px #F5F0FF, 1.8 line-height, 3px bordó bal border a paragrafus konténeren
```
---
## PROMPT 11 — Webshop lista (`/shop`)
**File:** `app/(app)/shop/page.tsx`
```
Valósítsd meg a BarcaPulse szurkolói bolt oldalát. Stílus: prémium sportmárkás kereskedelem.
PAGE HEADER:
- "WEB" Bebas Neue 80px arany + "SHOP" Bebas Neue 80px fehér, egymás alatt (lépcsős stacked)
- Header jobb oldal: "Szurkolói termékek · Gyors szállítás · Autentikus design" DM Sans 14px #9B97B8 vertical list
KATEGÓRIA SZŰRŐ: "ÖSSZES · MEZ · SAPKA · SÁL · KIEGÉSZÍTŐK" azonos mint játékosoknál
TERMÉK GRID (3 oszlop, 20px gap):
Minden kártya: #252240 bg, 0px radius
- Kép terület (280px): #2E2B4A bg-n termék; hover: zoom scale(1.03) smooth transition
- Kategória badge: top-left, #1D1A31 bg, Bebas Neue 12px
- HOVER: 2px bordó border csúszik le felülről (CSS animation: slideDown)
- Alul: Termék neve Bebas Neue 20px fehér + ár DM Sans 18px fehér + "Ft" szürke suffix
```
---
## PROMPT 12 — Termék részletoldal (`/shop/[id]`)
**File:** `app/(app)/shop/[id]/page.tsx`
```
Valósítsd meg az egytermék nézetét. Szerkesztői luxury termékoldal.
"← WEBSHOP" Space Mono 11px arany
KÉT OSZLOPOS LAYOUT (50/50, 0px gap):
BAL – KÉP PANEL (50%):
- Teljes magasságú, #1A1835 bg + noise grain
- Termék kép NAGY, rengeteg negatív térrel
- Alul: 4 kis négyzetes thumbnail vízszintesen (ha van több kép)
JOBB – TERMÉK ADATOK (50%, 48px padding):
- Kategória Bebas Neue 12px arany + 1px arány vonal
- Terméknév: Bebas Neue 52px #F5F0FF, line-height 1.0
- Ár: Bebas Neue 36px fehér; akciónál: eredeti strikethrough DM Sans 20px #9B97B8 felette
- "LEÍRÁS" Space Mono 10px arany + DM Sans 15px #9B97B8 paragrafus
- Vékony 1px elválasztó
- MÉRET: "VÁLASSZ MÉRETET" Space Mono; méret gombok 44×44px #2E2B4A, 0px radius; kiválasztott: #004D98 fill; hover: arany border
- DARABSZÁM: "−" | Bebas Neue 28px szám | "+" square gombok
- "KOSÁRBA" gomb: full-width, 56px, #A50044, 0px radius, Bebas Neue 22px; sikernél 2s zöld "HOZZÁADVA ✓"
- Készlet: Space Mono 11px zöld/amber dot + szöveg
```
---
## PROMPT 13 — Kosár (`/shop/cart`)
**File:** `app/(app)/shop/cart/page.tsx`
```
Valósítsd meg a bevásárlókosár oldalt. Szerkesztői checkout folyamat.
KÉT OSZLOPOS LAYOUT (65% / 35%, 32px gap):
BAL – TÉTELEK:
- "KOSÁR" Bebas Neue 48px fehér + "/" arany slash + "3 TERMÉK" Bebas Neue 48px arany — azonos baseline-on
- Minden terméksor: teljes szélességű, 1px bottom border rgba(255,255,255,0.07), 20px vertical padding
  - 72×72px kép, 0px radius
  - Bebas Neue 18px fehér terméknév, Space Mono 11px méret alatta
  - Mennyiség "−" | Bebas Neue 22px | "+" kis square gombok középre
  - Ár Bebas Neue 20px jobbra
  - Kuka ikon: hover: bordó (nincs bg doboz)
JOBB – ÖSSZEGZÉS (sticky, #252240, 24px padding):
- "ÖSSZEGZÉS" Bebas Neue 24px arany
- DM Sans 15px: részösszeg, szállítás
- 1px elválasztó
- "ÖSSZESEN: 14 970 FT" Bebas Neue 32px fehér
- "RENDELÉS LEADÁSA →" full-width bordó gomb Bebas Neue 20px
- "(szimulált fizetés)" Space Mono 10px #9B97B8
ÜRES KOSÁR ÁLLAPOT: "ÜRES" Bebas Neue 64px #252240 watermark + DM Sans 18px fehér "A kosár üres." + arany link
```
---
## PROMPT 14 — Szavazások (`/community/polls`)
**File:** `app/(app)/community/polls/page.tsx`
```
Valósítsd meg a szurkolói szavazás oldalt. Stílus: gamifikált közösség, szerkesztői tisztaság.
PAGE HEADER:
- "SZAVAZÁSOK" Bebas Neue 80px bal-flush
- DM Sans 15px alcím; jobb: "PONTJAID: 80 ★" Bebas Neue 24px arany
PONT BANNER: teljes szélességű sáv, 1px arany top/bottom border, #252240 bg; "★ PONTJAID: 80" + jobb oldal szöveg
SZAVAZÁS KÁRTYÁK (#252240 bg, 0px radius, 24px padding):
NEM SZAVAZOTT ÁLLAPOT:
- "AKTÍV SZAVAZÁS" Space Mono 10px bordó + 30px vonal; Bebas Neue 28px kérdés; lejárat dátum
- Opciók: teljes szélességű sorok, #2E2B4A bg, 1px border; hover: arany bal border + kék bg tint
- Kattintásra: loading → eredmény megjelenítésre vált (React state)
SZAVAZOTT ÁLLAPOT:
- Sávos eredmények: opció szöveg + % jobbra Space Mono 13px
- 6px magasságú sáv: #004D98 fill / #2E2B4A track, 0px radius
- Saját szavazat: arany border + "TE" Space Mono 9px badge
- Helyes: arany border + "✓ HELYES VÁLASZ" Space Mono
- Alul: "SZEREZTÉL 10 PONTOT! ✓" success sáv
```
---
## PROMPT 15 — Szurkolói chat (`/community/chat`)
**File:** `app/(app)/community/chat/page.tsx`
```
Valósítsd meg a valós idejű szurkolói chatet (Supabase Realtime-mal). Stílus: közösségi tér BarcaPulse DNA-val.
LAYOUT: Teljes magasság navbar alatt. Flex column: fejléc + scrollozható üzenetek + input sor.
CHAT FEJLÉC (#252240, 64px, 1px bottom border):
- Bal: "● SZURKOLÓI CHAT" — pulsáló zöld dot (CSS animation) + Bebas Neue 20px fehér
- Jobb: "ONLINE: 24 SZURKOLÓ" Space Mono 11px #9B97B8
ÜZENETEK TERÜLET (#1D1A31 bg, noise grain, 20px vízszintes padding):
- Más felhasználók: balra igazítva
  - Avatar kör 36px (arany border, Bebas Neue initials, #252240 bg)
  - Becenév Bebas Neue 14px arany + időbélyeg Space Mono 10px #9B97B8 ugyanabban a sorban
  - Üzenet buborék: #252240, 0px radius, 1px border, DM Sans 15px #F5F0FF, max-width 65%
- Saját üzenetek: jobbra igazítva
  - Buborék: #004D98 solid fill, 0px radius, DM Sans 14px fehér (nincs avatar)
- Nap elválasztó: "─────── MA, ÁPRILIS 1. ───────" Space Mono 10px #9B97B8
CHAT INPUT (#252240, 64px, 1px top border):
- Underline-style input full-width, 42px height, #2E2B4A bg, 0px radius, 1px bottom kék border
- Küldés gomb: 42×42px, #A50044, 0px radius, fehér papírrepülő ikon
```
---
## PROMPT 16 — Profil oldal (`/profile`)
**File:** `app/(app)/profile/page.tsx`
```
Valósítsd meg a felhasználói profil oldalt. Stílus: atléta identitáskártya + fan achievement showcase.
PROFIL HERO (200px, full-width):
- #252240 bg + enyhe kék-lila diagonal gradient + noise grain
- 3px bordó bal border a teljes section-ön
- Avatar kör 88px (arany 2px border, Bebas Neue 32px initials)
- "KOVÁCS JÁNOS" Bebas Neue 44px; "@kovacsjanos" Space Mono 14px arany; tagság dátum DM Sans 12px
- Jobb: "★ 80 PONT" Bebas Neue 40px arany + "SZAVAZÁSOKBÓL" Space Mono 10px
FIÓKBEÁLLÍTÁSOK ("BEÁLLÍTÁSOK" Space Mono 12px arany label):
- 3 sor (#252240, 1px border, full-width): 
  1. BECENÉV: underline input + "MENTÉS" kis kék square gomb inline
  2. JELSZÓ: összecsukható sor: Bebas Neue 16px + "▾"; kibontva: 2 underline input + "FRISSÍTÉS"
  3. PROFILKÉP: dashed 1px border zóna, "KATTINTS VAGY HÚZD IDE" Space Mono
JEGYEIM: "JEGYEIM" Bebas Neue 32px + db szám arany; hairline row táblázat DM Sans 14px; üres: "NEM VÁSÁROLTÁL MÉG JEGYET." Bebas Neue 24px #9B97B8
RENDELÉSEIM: azonos szekció stílus; státusz badge: Space Mono 11px zöld 1px border square
```
---
## PROMPT 17 — Chatbot Widget (globális)
**File:** `components/ChatbotWidget.tsx`
```
Valósítsd meg az AI chatbot floating widget-et. Globális komponens, minden auths oldalon megjelenik.
FLOATING GOMB (fixed, bottom-right, 24px margin):
- 60px átmérő kör
- Animált gradient háttér: kék #004D98 → bordó #A50044 → lila, lassú 4s CSS rotation
- Fehér villám/labda ikon 24px középen
- Pulsáló kék sugárzó shadow CSS keyframes-szel
- Hover: scale(1.08) + "BARÇA ASSZISZTENS" Space Mono 11px tooltip bal oldalon
DRAWER PANEL (380px széles, fixed jobb oldalon, slide-in animáció):
- #1D1A31 bg + noise grain + 1px bal border rgba(255,255,255,0.07)
- Fejléc: "BARÇA ASSZISZTENS" Bebas Neue 20px + kis bordó "AI" badge; "×" square gomb; 1px arány bottom rule
- Üzenetek: azonos stílus mint chat, de kisebb (14px); bot: mini crest avatar; user: kék buborék
- "..." typing indicator: 3 arany pont animáció
- Üdvözlő üzenet megjelenítve
- Input: underline stílus + bordó send gomb
```
---
## PROMPT 18 — Admin Dashboard (`/admin`)
**File:** `app/(admin)/dashboard/page.tsx`
```
Valósítsd meg az admin vezérlőpultot. Stílus: letisztult command center, BarcaPulse visual DNA megőrzésével — kevesebb szerkesztői káosz, több strukturált pontosság.
LAYOUT: Rögzített 240px bal sidebar + jobb oldali fő tartalom
SIDEBAR (#252240):
- "BARCAPULSE" Bebas Neue 16px arany + "ADMIN PANEL" Space Mono 10px #9B97B8; 1px arány elválasztó
- Menüpontok (48px sorok, 16px padding): ikon + DM Sans 14px szöveg
  - Aktív: 3px arany bal border + fehér szöveg + #2E2B4A bg
  - Inaktív: #9B97B8 szöveg
- Alul: admin avatar + "Admin" Space Mono 11px arány badge + kijelentkezés link
FŐ TARTALOM:
- "ADMIN ÁTTEKINTÉS" Bebas Neue 40px fehér; dátum Space Mono 11px jobbra
- 4 stat kártya (4 oszlop, 24px gap):
  - Minden kártya: #252240, 0px radius, egyedi 3px top border
  - Bal: 40px ikon; Jobb: Bebas Neue 48px érték + DM Sans 12px label
  - Kártyák: Hírek/12 (kék), Termékek/28 (bordó), Szavazások/3 (arány), Felhasználók/245 (teal)
```
---
## PROMPT 19 — Admin – Hírek kezelése (`/admin/news`)
**File:** `app/(admin)/news/page.tsx`
```
Admin hír lista oldal. Sidebar aktív: "Hírek".
FEJLÉC: "HÍREK KEZELÉSE" Bebas Neue 28px bal; "ÚJ HÍR LÉTREHOZÁSA +" kék square gomb jobbra
TÁBLÁZAT (#252240, 0px radius, full-width):
- Fejléc sor: #2E2B4A bg, Space Mono 11px #9B97B8 uppercase: CÍM | KATEGÓRIA | PUBLIKÁLVA | DÁTUM | MŰVELETEK
- Adat sorok: 1px bottom border; hover: #2E2B4A bg
  - CÍM: 36px négyzet thumbnail + Bebas Neue 16px fehér (ellipsis)
  - KATEGÓRIA: szín-kódolt square badge Bebas Neue 11px
  - PUBLIKÁLVA: "✓" zöld vagy "✗" halvány piros DM Sans
  - DÁTUM: Space Mono 12px #9B97B8
  - MŰVELETEK: "SZERK." kék ghost link + "/" + "TÖRLÉS" piros ghost link
```
---
## PROMPT 20 — Admin – Hír form (`/admin/news/new`, `/admin/news/[id]/edit`)
**File:** `app/(admin)/news/[...slug]/page.tsx`
```
Admin hír létrehozás/szerkesztés form. Tiszta, fókuszált szerkesztői form.
FEJLÉC: "ÚJ HÍR" Bebas Neue 32px + "← Vissza" Space Mono 11px arany jobbra
FORM (vertical, max-width 860px, 24px gap):
Minden input: underline stílus (1px bottom border #2E2B4A; fókuszban arany/kék); #1D1A31 bg; DM Sans 15px fehér szöveg; Label: Space Mono 11px #9B97B8 uppercase felette
1. CÍM — full-width, 56px height
2. SLUG — full-width; "Auto-generált" 11px hint alatta
3. KATEGÓRIA — custom #2E2B4A dropdown (nem native select)
4. TARTALOM — textarea 360px; karakter szám Space Mono 11px #9B97B8 jobb-lent
5. KÉP — dashed 1px rgba(255,255,255,0.12) zóna, 120px; upload után preview + "Eltávolítás ×" arany
6. PUBLIKÁLT — Space Mono label bal + toggle switch jobb (aktív: arany fill)
Alul: "MENTÉS →" bordó Bebas Neue 20px 52px + "MEGSZAKÍTÁS" DM Sans 14px #9B97B8 link
```
---
## PROMPT 21 — Admin – Termékek (`/admin/products`, `/admin/products/new`)
**File:** `app/(admin)/products/[...slug]/page.tsx`
```
Admin termék kezelő oldalak (lista + form).
LISTA TÁBLÁZAT: azonos stílus mint hírek. Oszlopok: thumbnail 48px | Terméknév Bebas Neue 16px | Ár Bebas Neue 18px | Kategória badge | Készlet Space Mono 13px (zöld ≥10 / amber 1-9 / piros 0 + sor piros tint) | Szerk./Törlés
TERMÉK FORM (azonos underline stílus):
Mezők: TERMÉK NEVE, ÁR (szám + "FT" Space Mono jobbra az inpuon belül), KATEGÓRIA (dropdown), LEÍRÁS (textarea 120px), MÉRETEK (dinamikus tagek: #2E2B4A 36px square tag × gombbal + "Méret hozzáadása" arány link), KÉSZLET (szám), KÉP (dashed dropzone)
```
---
## PROMPT 22 — Admin – Meccs jegyek (`/admin/matches`)
**File:** `app/(admin)/matches/page.tsx`
```
Admin meccs jegykezelés.
MECCS SOROK: teljes szélességű sor stílus (hairline border, nincs kártya)
- Bal: Bebas Neue dátum + DM Sans meccs cím
- Jobb: "JEGY HOZZÁADÁSA +" arány ghost gomb VAGY inline kompakt szektortáblázat (Space Mono 12px + kuka ikon)
MODAL (Jegy Hozzáadása):
- #252240 panel, 0px radius, 520px, 3px arány top border
- "JEGY HOZZÁADÁSA" Bebas Neue 24px + meccs subtitle Space Mono
- 4 szektor sor: checkbox (kék pipa) + "TRIBUNA" Bebas Neue 16px + "ÁR (€):" Space Mono 11px + 80px number input + "KAPACITÁS:" + 80px input
- Letiltott sorok: muted bg
- "MENTÉS →" bordó + "MÉGSE" ghost gomb
```
---
## PROMPT 23 — Admin – Játékos leírások (`/admin/players`, `/admin/players/[id]/edit`)
**File:** `app/(admin)/players/[...slug]/page.tsx`
```
Admin játékos leírás kezelés.
JÁTÉKOS LISTA: sor táblázat. 48px játékos kép kör (arány 1px border) | Bebas Neue 16px név | Space Mono 12px poszt + mez. Jobb: "SZERKESZTÉS" kék ghost VAGY "LEÍRÁS HOZZÁADÁSA +" bordó ghost. 1 sor DM Sans 13px #9B97B8 excerpt alul ha van.
EDIT FORM: Játékos fejléc (80px kör + Bebas Neue 40px + Space Mono poszt). "LEÍRÁS" Space Mono label + textarea 200px underline stílus. AI tipp kártya alatta: #2E2B4A bg, 1px arány bal border, "💡 Tipp: Használd az AI chatbotot a leírás összeállításához." DM Sans 13px. Gombok: "MENTÉS →" + "MÉGSE"
```
---
## PROMPT 24 — Admin – Szavazások (`/admin/polls`, `/admin/polls/new`, `/admin/polls/top`)
**File:** `app/(admin)/polls/[...slug]/page.tsx`
```
Admin szavazás kezelés (lista + form + top szavazók).
LISTA: Sor-kártyák. Kérdés Bebas Neue 18px | "3 opció" Space Mono 12px | "AKTÍV"/"INAKTÍV" square badge. Akciók: "SZERK." / "AKTIVÁL" / "TÖRLÉS". Fejléc: "SZAVAZÁSOK KEZELÉSE" + "ÚJ SZAVAZÁS +" gomb + "TOP SZAVAZÓK →" arány link
FORM mezők:
1. KÉRDÉS — 56px underline input
2. OPCIÓK — dinamikus: minden sor "#2E2B4A square, #" szám + text input + "×"; "OPCIÓ HOZZÁADÁSA +" arány link
3. HELYES VÁLASZ — radio csoport; kiválasztott: arany filled dot
4. LEJÁRAT — datetime-local underline input + "(nem kötelező)" Space Mono suffix
5. AKTÍV — toggle sor, arán aktív
TOP SZAVAZÓK OLDAL:
- "TOP SZAVAZÓK" Bebas Neue 48px + hónap Space Mono
- Pódium: 3 stat kártya (#1 középen, magas, 3px arány top border; #2 ezüst bal; #3 bronz jobb)
- Alatta: standard hairline sor táblázat Space Mono 12px adatokkal
```
---
## PROMPT 25 — Loading Skeleton állapotok
**File:** `components/skeletons/*.tsx`
```
Valósítsd meg a loading skeleton placeholder állapotokat. Ne szürke dobozok legyenek — szerkesztői layoutot tükröző animált skeleton-ok.
SHIMMER ANIMÁCIÓ (CSS keyframes):
background: linear-gradient(105deg, #252240 0%, #2E2B4A 50%, #252240 100%);
background-size: 200%;
animation: shimmer 1.8s infinite;
@keyframes shimmer {
  from { background-position: 200% center; }
  to { background-position: -200% center; }
}
border-radius: 0px mindenhol
DASHBOARD SKELETON (components/skeletons/DashboardSkeleton.tsx):
- 3 szerkesztői hírkártya skeleton: aszimmetrikus méretben (1 széles + 2 stacked szűk)
- 1 teljes szélességű 100px meccs kártya shimmer
- 3 kis vízszintes eredmény strip
NEWS GRID SKELETON (components/skeletons/NewsGridSkeleton.tsx):
- Tükrözi az editorial mixed-density rácsot: 1 wide (240px kép shimmer + 2 bar) + 2 egyenlő az 1. sorban; 3 egyenlő a 2. sorban
PLAYERS GRID SKELETON (components/skeletons/PlayersGridSkeleton.tsx):
- 4 oszlop, 12 kártya; minden: 180px shimmer tower + 2 shimmer bar
PRODUCTS GRID SKELETON (components/skeletons/ProductsGridSkeleton.tsx):
- 3 oszlop, 9 kártya; minden: 280px shimmer square + 2 bar
MATCHES SKELETON (components/skeletons/MatchesSkeleton.tsx):
- 5 teljes szélességű sor shimmer; minden: horizontal flex — bal dátum/idő shimmer + közép 3 eltolt bar + jobb kis blokk; 1px shimmer vonal elválasztás
```