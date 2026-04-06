# Plan.md – Megvalósítási iterációk (Claude Code)
**FC Barcelona Fan Webapp**

> Minden iteráció önálló, futtatható egység. Elég annyit írni: "Hajtsd végre a [X.Y] iterációt."
> Stack: Next.js 14 (App Router, Server Actions), Tailwind CSS, shadcn/ui, Supabase, API-Football (RapidAPI), Claude API (Anthropic)

---

## FÁZIS 0 – Projekt alap

### Iter 0.1 – Next.js projekt + konfiguráció
**Feladatok:**
1. Inicializálj egy új Next.js 14 projektet App Router-rel, TypeScript-tel, Tailwind CSS-sel: `npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"`
2. Telepítsd a shadcn/ui-t: `npx shadcn@latest init` – válaszd a default stílust
3. Telepítsd a szükséges csomagokat: `npm install @supabase/supabase-js @supabase/ssr zustand`
4. Hozd létre a `.env.local` fájlt az alábbi kulcsokkal (értékek nélkül, csak placeholderrel):
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   RAPIDAPI_KEY=
   ANTHROPIC_API_KEY=
   ```
5. Hozd létre a `.env.local.example` fájlt ugyanezekkel a kulcsokkal.
6. Adj hozzá `NEXT_PUBLIC_SUPABASE_URL` és `NEXT_PUBLIC_SUPABASE_ANON_KEY` hivatkozásokat a `next.config.ts`-be.

---

### Iter 0.2 – Supabase séma + RLS + Storage
**Feladatok:**
1. Hozd létre a `supabase/migrations/001_initial_schema.sql` fájlt az alábbi teljes SQL tartalommal:
```sql
-- PROFILES
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  nickname text,
  avatar_url text,
  points integer not null default 0,
  role text not null default 'user' check (role in ('user', 'admin'))
);
alter table profiles enable row level security;
create policy "Public read" on profiles for select using (true);
create policy "Own update" on profiles for update using (auth.uid() = id);

-- NEWS
create table news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  category text not null,
  content text not null,
  image_url text,
  published boolean not null default false,
  created_at timestamptz not null default now()
);
alter table news enable row level security;
create policy "Public read published" on news for select using (published = true);
create policy "Admin all" on news for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- PRODUCTS
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null,
  category text not null,
  description text,
  sizes text[] not null default '{}',
  image_url text,
  stock integer not null default 0
);
alter table products enable row level security;
create policy "Public read" on products for select using (true);
create policy "Admin all" on products for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- ORDERS
create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  items jsonb not null,
  total numeric(10,2) not null,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);
alter table orders enable row level security;
create policy "Own read" on orders for select using (auth.uid() = user_id);
create policy "Own insert" on orders for insert with check (auth.uid() = user_id);
create policy "Admin all" on orders for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- MATCH TICKETS
create table match_tickets (
  id uuid primary key default gen_random_uuid(),
  api_match_id integer not null,
  sector text not null check (sector in ('tribuna', 'gol_nord', 'gol_sud', 'lateral')),
  price numeric(10,2) not null,
  capacity integer not null,
  sold integer not null default 0
);
alter table match_tickets enable row level security;
create policy "Public read" on match_tickets for select using (true);
create policy "Admin all" on match_tickets for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- PURCHASED TICKETS
create table purchased_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  match_ticket_id uuid not null references match_tickets on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);
alter table purchased_tickets enable row level security;
create policy "Own read" on purchased_tickets for select using (auth.uid() = user_id);
create policy "Own insert" on purchased_tickets for insert with check (auth.uid() = user_id);
create policy "Admin all" on purchased_tickets for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- POLLS
create table polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  options jsonb not null,
  correct_option integer,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table polls enable row level security;
create policy "Public read active" on polls for select using (is_active = true);
create policy "Admin all" on polls for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- POLL VOTES
create table poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  selected_option integer not null,
  created_at timestamptz not null default now(),
  unique(poll_id, user_id)
);
alter table poll_votes enable row level security;
create policy "Own read" on poll_votes for select using (auth.uid() = user_id);
create policy "Own insert" on poll_votes for insert with check (auth.uid() = user_id);
create policy "Admin read" on poll_votes for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- CHAT MESSAGES
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
alter table chat_messages enable row level security;
create policy "Authenticated read" on chat_messages for select using (auth.role() = 'authenticated');
create policy "Own insert" on chat_messages for insert with check (auth.uid() = user_id);

-- PLAYER DESCRIPTIONS
create table player_descriptions (
  api_player_id integer primary key,
  description text not null
);
alter table player_descriptions enable row level security;
create policy "Public read" on player_descriptions for select using (true);
create policy "Admin all" on player_descriptions for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
```
2. Hozd létre a `supabase/seed.sql` fájlt, amely egy admin felhasználó profil bejegyzést illeszt be placeholderrel (UUID-t kommentként jelezve, manuálisan töltendő ki).
3. A `README.md`-be írd bele a Storage bucket-ek neveit, amelyeket manuálisan kell létrehozni a Supabase dashboardon: `avatars`, `news-images`, `product-images`.

---

### Iter 0.3 – Supabase kliensek + layout
**Feladatok:**
1. Hozd létre a `src/lib/supabase/client.ts` fájlt – böngésző oldali Supabase kliens (`createBrowserClient` az `@supabase/ssr`-ből).
2. Hozd létre a `src/lib/supabase/server.ts` fájlt – szerver oldali Supabase kliens (`createServerClient` cookies-szal).
3. Hozd létre a `src/lib/supabase/middleware.ts` fájlt – session frissítő helper.
4. Hozd létre a `src/middleware.ts` fájlt, amely:
   - Minden kéréshez frissíti a Supabase session-t.
   - Ha a path `/dashboard/**` vagy `/community/**` vagy `/profile` vagy `/tickets/**` vagy `/shop/**` vagy `/players/**` vagy `/matches/**` és nincs bejelentkezett user → redirect `/login`-ra.
   - Ha a path `/admin/**` és a user role nem `admin` → redirect `/dashboard`-ra.
   - Ha a path `/login` vagy `/register` és van bejelentkezett user → redirect `/dashboard`-ra.
5. Hozd létre a `src/app/layout.tsx`-t Inter fonttal, `<html lang="hu">` taggel.
6. Hozd létre a `src/components/layout/Navbar.tsx` komponenst:
   - Props: `user: User | null`, `role: string | null`
   - Guest nézet: Logo bal oldalon, jobb oldalon "Bejelentkezés" és "Regisztráció" linkek.
   - User nézet: Logo, navigációs linkek (Főoldal, Hírek, Meccsek, Játékosok, Webshop, Közösség), jobb oldalon Profil link + Kijelentkezés gomb.
   - Admin nézet: User nézet + "Admin" link.
   - Kijelentkezés gomb Supabase `signOut()` hívással, redirect `/`-re.
7. Hozd létre a `src/components/layout/Footer.tsx` komponenst – egyszerű footer klub névvel és évszámmal.
8. Hozd létre a `src/app/(protected)/layout.tsx`-t, amely lekéri a user-t és a profilt szerveroldalon, és átadja a Navbar-nak.
9. Hozd létre a `src/app/(guest)/layout.tsx`-t guest Navbar-ral.

---

## FÁZIS 1 – Auth

### Iter 1.1 – Regisztrációs oldal
**Feladatok:**
1. Telepítsd a szükséges shadcn/ui komponenseket: `npx shadcn@latest add card input label button`
2. Hozd létre a `src/app/(auth)/register/page.tsx` fájlt:
   - Form mezők: Teljes név (kötelező), Email (kötelező), Jelszó (kötelező, min 6 kar.), Becenév (opcionális).
   - Submit Server Action (`src/app/(auth)/register/actions.ts`):
     1. `supabase.auth.signUp({ email, password })`
     2. Ha sikeres: `profiles` táblába insert (id = user.id, full_name, nickname – ha üres, full_name első szava).
     3. Redirect `/login?registered=true`-ra.
   - Ha `registered=true` query param van: jelenítse meg a "Sikeres regisztráció, ellenőrizd az emailed" üzenetet.
   - Validációs hibák megjelenítése a mezők alatt.

---

### Iter 1.2 – Bejelentkezési oldal
**Feladatok:**
1. Hozd létre a `src/app/(auth)/login/page.tsx` fájlt:
   - Form mezők: Email, Jelszó.
   - Submit Server Action (`src/app/(auth)/login/actions.ts`):
     1. `supabase.auth.signInWithPassword({ email, password })`
     2. Ha sikeres: redirect `/dashboard`-ra.
     3. Ha hiba: jelenítse meg a "Hibás email vagy jelszó" üzenetet.
   - Link a regisztrációs oldalra.

---

### Iter 1.3 – Auth helper + user lekérés
**Feladatok:**
1. Hozd létre a `src/lib/auth/getUser.ts` helper-t:
   - Szerver oldali, visszaad egy `{ user, profile }` objektumot vagy `{ user: null, profile: null }`-t.
   - Lekéri a `profiles` táblából a role-t is.
2. Hozd létre a `src/lib/auth/requireAuth.ts` helper-t:
   - Ha nincs user → redirect `/login`-ra (szerver oldali).
   - Visszaadja a `{ user, profile }` objektumot.
3. Hozd létre a `src/lib/auth/requireAdmin.ts` helper-t:
   - Ha nincs user vagy role !== 'admin' → redirect `/dashboard`-ra.

---

## FÁZIS 2 – Landing Page

### Iter 2.1 – Landing page alap struktúra
**Feladatok:**
1. Hozd létre a `src/app/(guest)/page.tsx` fájlt.
2. **Hero szekció:** Teljes képernyős szekció, nagy cím ("Més que un club"), alcím, két gomb: "Regisztráció" (`/register`) és "Bejelentkezés" (`/login`).
3. **A klubról szekció:** Három statisztikai kártya: "1899 óta" (alapítás), "125+ trófea" (trófeák), "Més que un club" (mottó).
4. **Fan oldal bemutató szekció:** Rövid szöveges leírás arról, hogy ez egy rajongói platform.

---

### Iter 2.2 – Feature kártyák szekció
**Feladatok:**
1. A landing page-hez add hozzá a Feature grid szekciót:
   - 4 kártya: "Hírek" (Newspaper ikon), "Jegyvásárlás" (Ticket ikon), "Webshop" (ShoppingBag ikon), "Közösség" (Users ikon).
   - Minden kártya: ikon, cím, rövid leírás szöveg.
   - Ikon forrás: `lucide-react` csomag (`npm install lucide-react`).
2. Add hozzá a CTA banner szekciót: "Csatlakozz a közösséghez" cím, "Regisztrálj most" gomb.

---

## FÁZIS 3 – API-Football integráció

### Iter 3.1 – API-Football kliens + típusok
**Feladatok:**
1. Hozd létre a `src/lib/api-football/client.ts` fájlt:
   - `apiFetch(endpoint: string, params: Record<string, string>)` async függvény.
   - Base URL: `https://api-football-v1.p.rapidapi.com/v3`
   - Headers: `X-RapidAPI-Key: process.env.RAPIDAPI_KEY`, `X-RapidAPI-Host: api-football-v1.p.rapidapi.com`
   - Next.js fetch cache: `next: { revalidate: 3600 }` (1 óra)
2. Hozd létre a `src/lib/api-football/types.ts` fájlt az alábbi TypeScript típusokkal:
   - `ApiFixture`: id, date, homeTeam (name, logo), awayTeam (name, logo), homeGoals, awayGoals, status, venue.
   - `ApiPlayer`: id, name, age, nationality, photo, number, position.
   - `ApiPlayerStats`: goals, assists, appearances, yellowCards, redCards.
   - `ApiStanding`: rank, team (name, logo), points, goalsDiff, form, wins, draws, losses, played.

---

### Iter 3.2 – Meccs lekérő függvények
**Feladatok:**
1. Hozd létre a `src/lib/api-football/matches.ts` fájlt:
   - Konstansok: `BARCA_TEAM_ID = 529`, `LA_LIGA_ID = 140`, `CURRENT_SEASON = 2025`
   - `getUpcomingMatches(count = 5): Promise<ApiFixture[]>` – endpoint: `/fixtures`, params: `team=529&next={count}`
   - `getRecentMatches(count = 5): Promise<ApiFixture[]>` – endpoint: `/fixtures`, params: `team=529&last={count}`
   - `getStandings(): Promise<ApiStanding[]>` – endpoint: `/standings`, params: `league=140&season=2025`
   - `getBarçaStanding(): Promise<ApiStanding | null>` – a standings-ból szűri ki a 529 id-jű csapatot.

---

### Iter 3.3 – Játékos lekérő függvények
**Feladatok:**
1. Hozd létre a `src/lib/api-football/players.ts` fájlt:
   - `getSquad(): Promise<ApiPlayer[]>` – endpoint: `/players/squads`, params: `team=529`
   - `getPlayerStats(playerId: number): Promise<{ player: ApiPlayer, stats: ApiPlayerStats } | null>` – endpoint: `/players`, params: `id={playerId}&season=2025`
   - `getTopScorers(count = 3): Promise<{ player: ApiPlayer, goals: number }[]>` – a squad első `count` játékosához kér statisztikát, rendezi gólok szerint.

---

## FÁZIS 4 – Dashboard főoldal

### Iter 4.1 – Dashboard layout + hírek szekció
**Feladatok:**
1. Telepítsd: `npx shadcn@latest add card badge`
2. Hozd létre a `src/app/(protected)/dashboard/page.tsx` fájlt:
   - Szerver komponens, hívja a `requireAuth` helper-t.
3. Hozd létre a `src/components/dashboard/NewsSection.tsx` szerver komponenst:
   - Supabase-ből lekéri a legfrissebb 3 publikált hírt (created_at DESC).
   - Minden hírhez: kép, cím, kategória badge, dátum, "Tovább" link `/news/[id]`-re.
   - Szekció tetején: "Hírek" cím + "Összes hír" link `/news`-ra.
4. Add hozzá a `NewsSection`-t a dashboard page-hez.

---

### Iter 4.2 – Dashboard meccs szekció
**Feladatok:**
1. Hozd létre a `src/components/dashboard/MatchSection.tsx` szerver komponenst:
   - Hívja a `getUpcomingMatches(1)` és `getRecentMatches(3)` függvényeket.
   - **Következő meccs:** Dátum, ellenfél neve + logója, helyszín, "Jegyet venni" link (ha van match_tickets a DB-ben az adott api_match_id-hoz).
   - **Utolsó 3 eredmény:** Meccs kártyák – hazai csapat vs vendég csapat, eredmény, dátum.
   - Szekció tetején: "Meccsek" cím + "Összes meccs" link `/matches`-re.
2. Add hozzá a `MatchSection`-t a dashboard page-hez.

---

### Iter 4.3 – Dashboard tabella + játékos szekció
**Feladatok:**
1. Hozd létre a `src/components/dashboard/StandingsSection.tsx` szerver komponenst:
   - Hívja a `getBarçaStanding()` függvényt.
   - Megjelenít: helyezés, pontok, győzelmek/döntetlenek/vereségek, gólkülönbség.
2. Hozd létre a `src/components/dashboard/PlayersSection.tsx` szerver komponenst:
   - Hívja a `getTopScorers(3)` függvényt.
   - 3 játékos kártya: fotó, név, gólok száma.
   - Szekció tetején: "Játékosok" cím + "Összes játékos" link `/players`-re.
3. Add hozzá mindkettőt a dashboard page-hez.

---

### Iter 4.4 – Dashboard trófeák + szavazás szekció
**Feladatok:**
1. Hozd létre a `src/components/dashboard/TrophiesSection.tsx` komponenst:
   - Statikus adatok: La Liga: 27, Copa del Rey: 31, Champions League: 5, Supercopa: 15.
   - Minden trófea: szám, neve.
2. Hozd létre a `src/components/dashboard/PollSection.tsx` szerver komponenst:
   - Supabase-ből lekéri az első aktív (`is_active = true`) szavazást.
   - Ha nincs aktív szavazás: "Hamarosan új szavazás" szöveg.
   - Ha van: kérdés + "Szavazás" link `/community/polls`-ra.
3. Add hozzá mindkettőt a dashboard page-hez.

---

## FÁZIS 5 – Hírek

### Iter 5.1 – Hírek listaoldal
**Feladatok:**
1. Hozd létre a `src/app/(protected)/news/page.tsx` szerver komponenst:
   - URL search param: `?category=` szűrőhöz, `?page=` paginationhoz.
   - Supabase query: `published = true`, rendezés `created_at DESC`, 9 elem/oldal.
   - Kategória szűrő: a DB-ből lekéri az összes egyedi kategóriát, megjelenít szűrő gombokat.
   - Kártya grid: kép, cím, kategória badge, dátum, "Olvasd tovább" link.
   - Pagination: "Előző" / "Következő" gombok, oldal számlálóval.

---

### Iter 5.2 – Hír részletoldal
**Feladatok:**
1. Hozd létre a `src/app/(protected)/news/[id]/page.tsx` szerver komponenst:
   - Supabase-ből lekéri a hírt id alapján. Ha nem létezik: `notFound()`.
   - Megjelenít: nagy kép, kategória badge, cím, dátum, teljes content szöveg (`<article>` tagben).
   - Vissza gomb a `/news` oldalra.
   - `generateMetadata` függvény: title = hír címe.

---

## FÁZIS 6 – Meccsek + Jegyvásárlás

### Iter 6.1 – Meccsek listaoldal
**Feladatok:**
1. Hozd létre a `src/app/(protected)/matches/page.tsx` szerver komponenst:
   - Hívja a `getUpcomingMatches(10)` és `getRecentMatches(10)` függvényeket.
   - Supabase-ből lekéri az összes `match_tickets` sort (hogy tudja, melyik meccshez van jegy).
   - **Következő meccsek szekció:** Kártyák – dátum, hazai vs vendég logóval, helyszín. Ha a meccs `api_match_id`-ja szerepel a `match_tickets`-ben: "Jegyet venni" gomb, link `/tickets/[api_match_id]`-re.
   - **Eredmények szekció:** Lejátszott meccsek kártyái – végeredménnyel.

---

### Iter 6.2 – Stadion SVG térkép komponens
**Feladatok:**
1. Hozd létre a `src/components/stadium/StadiumMap.tsx` kliens komponenst:
   - 4 szektort tartalmazó SVG térkép (Camp Nou leegyszerűsített, ovális alaprajza):
     - `tribuna` – bal oldal (fő lelátó)
     - `gol_nord` – felső kapu mögötti rész
     - `gol_sud` – alsó kapu mögötti rész
     - `lateral` – jobb oldal
   - Props: `sectors: { id: string, label: string, price: number, available: number }[]`, `onSelect: (sectorId: string) => void`, `selected: string | null`
   - Kattintható SVG `<path>` elemek, kiválasztott szektoron vizuális kiemelés (stroke vastagabb, eltérő fill szín).
   - Minden szektorhoz tooltip (hover-re): szektor neve, ár, szabad helyek.

---

### Iter 6.3 – Jegyvásárlás oldal
**Feladatok:**
1. Telepítsd: `npx shadcn@latest add dialog`
2. Hozd létre a `src/app/(protected)/tickets/[matchId]/page.tsx` komponenst:
   - URL param: `matchId` = API-Football fixture ID.
   - Szerver oldalon: lekéri a meccs adatait `getUpcomingMatches()` hívással (szűrés matchId-ra), és a `match_tickets`-et Supabase-ből az adott `api_match_id`-ra.
   - Ha nincs meccs vagy nincs jegy: "Erre a meccsre nem érhető el jegyvásárlás" üzenet.
   - Bal oldal: Meccs adatai (dátum, hazai vs vendég csapat, helyszín).
   - Jobb oldal: `StadiumMap` komponens, alatta kiválasztott szektornál: ár/jegy, szabad helyek száma, darabszám input (1–10), végösszeg, "Jegy vásárlása" gomb.
3. Hozd létre a `src/app/(protected)/tickets/actions.ts` Server Action-t – `purchaseTickets(matchTicketId, quantity)`:
   1. `requireAuth` ellenőrzés.
   2. Ellenőrzi: `sold + quantity <= capacity`.
   3. `purchased_tickets` insert.
   4. `match_tickets.sold` frissítése (`sold + quantity`).
   5. Visszaad `{ success: true }` vagy `{ error: string }`.
4. Sikeres vásárlás: Dialog modal "Sikeres jegyvásárlás! A jegyeid megtalálhatók a profilodban." szöveggel, "Rendben" gomb, redirect `/matches`-re.

---

## FÁZIS 7 – Játékosok

### Iter 7.1 – Játékos lista oldal
**Feladatok:**
1. Hozd létre a `src/app/(protected)/players/page.tsx` szerver komponenst:
   - Hívja a `getSquad()` függvényt.
   - URL search param `?position=` szűrőhöz.
   - Szűrő gombok: "Mind", "Kapus", "Védő", "Középpályás", "Támadó".
   - Kártya grid: API-Football fotó, név, mez szám badge, pozíció. Link `/players/[id]`-re.

---

### Iter 7.2 – Játékos részletoldal
**Feladatok:**
1. Hozd létre a `src/app/(protected)/players/[id]/page.tsx` szerver komponenst:
   - Hívja a `getPlayerStats(Number(id))` függvényt. Ha nincs találat: `notFound()`.
   - Supabase-ből lekéri a `player_descriptions`-t az `api_player_id`-ra.
   - Megjelenít: nagy fotó, teljes név, mez szám, kor, állampolgárság, pozíció.
   - Statisztika táblázat: Mérkőzések, Gólok, Gólpasszok, Sárga lapok, Piros lapok.
   - Ha van leírás a DB-ben: leírás szöveg megjelenítése.
   - Vissza gomb `/players`-re.
   - `generateMetadata`: title = játékos neve.

---

## FÁZIS 8 – Webshop

### Iter 8.1 – Termék lista oldal + kosár store
**Feladatok:**
1. Hozd létre a `src/lib/store/cartStore.ts` fájlt Zustand-dal:
   - State: `items: { productId, name, price, size, qty, imageUrl }[]`
   - Actions: `addItem`, `removeItem`, `updateQty`, `clearCart`
   - `persist` middleware LocalStorage-zsal.
2. Hozd létre a `src/app/(protected)/shop/page.tsx` szerver komponenst:
   - Supabase-ből lekéri az összes terméket.
   - URL search param `?category=` szűrőhöz.
   - Kártya grid: termék kép, név, ár, kategória badge. Link `/shop/[id]`-re.
3. Hozd létre a `src/components/layout/CartIcon.tsx` kliens komponenst:
   - `cartStore`-ból mutatja a kosárban lévő tételek számát badge-ként.
   - Link `/shop/cart`-ra.
   - Add hozzá a `Navbar.tsx`-hez (csak bejelentkezett user nézetnél).

---

### Iter 8.2 – Termék részletoldal
**Feladatok:**
1. Telepítsd: `npx shadcn@latest add toast`
2. Hozd létre a `src/app/(protected)/shop/[id]/page.tsx` kliens komponenst:
   - Supabase-ből lekéri a terméket id alapján. Ha nincs: `notFound()`.
   - Nagy kép (Supabase Storage URL), termék neve, ára, leírása.
   - Méret select (`sizes` tömb alapján; ha üres tömb: méretválasztó nem jelenik meg).
   - Darabszám input (1–10).
   - "Kosárba" gomb: `cartStore.addItem` hívás + toast megjelenítése ("Hozzáadva a kosárhoz").
   - Vissza gomb `/shop`-ra.
   - `generateMetadata`: title = termék neve.

---

### Iter 8.3 – Kosár + szimulált checkout
**Feladatok:**
1. Hozd létre a `src/app/(protected)/shop/cart/page.tsx` kliens komponenst:
   - `cartStore`-ból listázza a tételeket: kép, név, méret, darabszám +/- gombok, sor ár, törlés gomb.
   - Összesítő: végösszeg, "Rendelés leadása" gomb.
   - Üres kosár: "A kosár üres" üzenet + "Vissza a shopba" link.
2. Hozd létre a `src/app/(protected)/shop/cart/actions.ts` Server Action-t – `placeOrder(items, total)`:
   1. `requireAuth` ellenőrzés.
   2. `orders` tábla insert.
   3. Visszaad `{ orderId: string }`.
3. Sikeres rendelés: Dialog modal "Rendelés sikeresen leadva! Rendelés azonosítója: [orderId]", "Rendben" gomb, redirect `/shop`-ra, `cartStore.clearCart()` hívás.

---

## FÁZIS 9 – Közösség

### Iter 9.1 – Szavazás oldal (megjelenítés)
**Feladatok:**
1. Telepítsd: `npx shadcn@latest add progress`
2. Hozd létre a `src/app/(protected)/community/polls/page.tsx` szerver komponenst:
   - Supabase-ből lekéri az aktív szavazásokat (`is_active = true`, `expires_at > now()` vagy null).
   - Minden szavazáshoz lekéri a current user saját szavazatát a `poll_votes` táblából.
   - Ha már szavazott: opciók Progress bar-ral (%-ban), helyes opció kiemelve.
   - Ha még nem szavazott: opció gombok (kliens komponens).

---

### Iter 9.2 – Szavazat leadás + pontrendszer
**Feladatok:**
1. Hozd létre a `src/app/(protected)/community/polls/actions.ts` Server Action-t – `castVote(pollId: string, selectedOption: number)`:
   1. `requireAuth` ellenőrzés.
   2. Ellenőrzi, hogy a user már szavazott-e (`poll_votes` unique constraint).
   3. `poll_votes` insert.
   4. Ha van `correct_option` és egyezik a `selectedOption`-nel: `UPDATE profiles SET points = points + 10 WHERE id = user_id`.
   5. Visszaad `{ success: true, correct: boolean, pointsEarned: number }`.
2. Hozd létre a `src/components/polls/PollCard.tsx` kliens komponenst:
   - Props: `poll`, `userVote: number | null`
   - Ha `userVote` null: szavazó gombok, `castVote` action hívása kattintásra, majd `revalidatePath('/community/polls')`.
   - Ha `userVote` nem null: Progress bar-os eredmény nézet.

---

### Iter 9.3 – Chat oldal
**Feladatok:**
1. Hozd létre a `src/app/(protected)/community/chat/page.tsx` szerver komponenst:
   - Lekéri a legutolsó 50 üzenetet Supabase-ből (`created_at ASC`, limit 50), JOIN `profiles`-ra (nickname, avatar_url).
   - Átadja az üzeneteket és a current user-t a `ChatWindow` kliens komponensnek.
2. Hozd létre a `src/components/chat/ChatWindow.tsx` kliens komponenst:
   - Props: `initialMessages: MessageWithProfile[]`, `currentUser: Profile`
   - `useEffect`-ben Supabase Realtime channel feliratkozás: `chat_messages` tábla INSERT event-re. Új üzenetnél fetch a sender profile-ját, append az üzenet listához.
   - Üzenet lista: avatar (initials fallback ha nincs kép), becenév, szöveg, időbélyeg.
   - Auto-scroll az utolsó üzenetre (`useRef` + `scrollIntoView`).
   - Input mező + "Küldés" gomb. Enter billentyűre is küld. Üres üzenet nem küldhető.
3. Hozd létre a `src/app/(protected)/community/chat/actions.ts` Server Action-t – `sendMessage(content: string)`:
   - `requireAuth` ellenőrzés.
   - `chat_messages` insert a current user id-jával.

---

## FÁZIS 10 – Profil

### Iter 10.1 – Profil oldal (adatok + kép)
**Feladatok:**
1. Telepítsd: `npx shadcn@latest add avatar separator`
2. Hozd létre a `src/app/(protected)/profile/page.tsx` szerver komponenst:
   - `requireAuth`-szal lekéri a profil adatokat.
3. Hozd létre a `src/components/profile/AvatarUpload.tsx` kliens komponenst:
   - Fájl input (accept="image/*", max 2MB kliens oldali ellenőrzés).
   - Feltöltés: Supabase Storage `avatars` bucket, fájlnév: `{userId}.{extension}`.
   - Feltöltés után: `UPDATE profiles SET avatar_url = [publikus URL] WHERE id = userId`.
   - Feltöltés előtt preview megjelenítése.
4. Hozd létre a `src/components/profile/UpdateProfileForm.tsx` kliens komponenst:
   - Becenév szerkesztése.
   - Server Action `updateNickname(nickname: string)`: `UPDATE profiles SET nickname = $1 WHERE id = auth.uid()`.
5. Hozd létre a `src/components/profile/ChangePasswordForm.tsx` kliens komponenst:
   - Új jelszó + megerősítés mezők.
   - Server Action `changePassword(newPassword: string)`: `supabase.auth.updateUser({ password: newPassword })`.
   - Hibaüzenetek megjelenítése.

---

### Iter 10.2 – Profil: saját jegyek + rendelések
**Feladatok:**
1. Hozd létre a `src/components/profile/MyTickets.tsx` szerver komponenst:
   - Supabase: `SELECT * FROM purchased_tickets JOIN match_tickets ON ... WHERE user_id = current_user`.
   - Minden tétel: meccs api_match_id, szektor neve, darabszám, vásárlás dátuma.
   - Üres állap: "Még nem vásároltál jegyet."
2. Hozd létre a `src/components/profile/MyOrders.tsx` szerver komponenst:
   - Supabase: `SELECT * FROM orders WHERE user_id = current_user ORDER BY created_at DESC`.
   - Minden rendelés: rendelés ID (első 8 karakter), dátum, összeg, státusz badge.
   - Üres állapot: "Még nincs rendelésed."
3. Add hozzá mindkét komponenst a `profile/page.tsx` alsó részéhez.

---

## FÁZIS 11 – Chatbot

### Iter 11.1 – Chatbot API route
**Feladatok:**
1. Telepítsd: `npm install @anthropic-ai/sdk`
2. Hozd létre a `src/app/api/chatbot/route.ts` POST route-ot:
   - Request body: `{ messages: { role: 'user' | 'assistant', content: string }[] }`
   - Supabase session ellenőrzés – ha nincs bejelentkezett user: 401 válasz.
   - Anthropic kliens: `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })`.
   - Model: `claude-haiku-4-5`, max_tokens: 500.
   - System prompt:
     ```
     Te az FC Barcelona rajongói webapp asszisztense vagy. Magyarul válaszolj.
     Segíthetsz a következő témákban: FC Barcelona klub história, játékosok, meccsek és eredmények,
     jegyvásárlás folyamata az oldalon, webshop termékek, szurkolói közösség funkciók (chat, szavazások).
     Légy barátságos, tömör és lelkes Barça szurkoló. Ha nem tudsz valamit, mondd meg őszintén.
     ```
   - Streaming response: `anthropic.messages.stream(...)`, `new Response(stream.toReadableStream())`.

---

### Iter 11.2 – Chatbot UI widget
**Feladatok:**
1. Telepítsd: `npx shadcn@latest add sheet`
2. Hozd létre a `src/components/chatbot/ChatbotWidget.tsx` kliens komponenst:
   - Jobb alsó sarokban `fixed bottom-4 right-4` pozicionált kerek gomb (MessageCircle ikon).
   - Kattintásra shadcn Sheet nyílik jobbról: "Barça Asszisztens" header, X gomb.
   - State: `messages: {role, content}[]`, `input: string`, `isLoading: boolean`.
   - Üzenetküldéskor: POST `/api/chatbot`-ra a teljes üzenetelőzménnyel. Streaming response olvasása `ReadableStream`-mel: az asszisztens válasza karakterenként appendelődik.
   - User üzenetek jobbra igazítva, asszisztens üzenetek balra. Betöltés közben "..." animáció.
   - Input + "Küldés" gomb, Enter billentyű is küld.
3. Add hozzá a `src/app/(protected)/layout.tsx`-hez a `<ChatbotWidget />` komponenst.

---

## FÁZIS 12 – Admin felület

### Iter 12.1 – Admin layout + dashboard
**Feladatok:**
1. Hozd létre a `src/app/admin/layout.tsx`-t:
   - `requireAdmin()` hívás szerveroldalon.
   - Bal oldali sidebar navigáció linkekkel: Áttekintés (`/admin`), Hírek (`/admin/news`), Termékek (`/admin/products`), Meccsek/Jegyek (`/admin/matches`), Játékosok (`/admin/players`), Szavazások (`/admin/polls`).
   - Főtartalom jobb oldalon `{children}`.
2. Hozd létre a `src/app/admin/page.tsx` szerver komponenst:
   - 4 statisztikai kártya Supabase `count` query-kkel:
     - Publikált hírek száma (`news WHERE published = true`)
     - Termékek száma (`products`)
     - Aktív szavazások száma (`polls WHERE is_active = true`)
     - Regisztrált felhasználók száma (`profiles WHERE role = 'user'`)

---

### Iter 12.2 – Admin: Hírek CRUD
**Feladatok:**
1. Hozd létre a `src/app/admin/news/page.tsx` szerver komponenst:
   - Összes hír listázása táblázatban: cím, kategória, publikált (✓/✗), dátum, Szerkesztés gomb, Törlés gomb.
   - "Új hír" gomb linkkel `/admin/news/new`-ra.
2. Hozd létre a `src/app/admin/news/new/page.tsx` kliens komponenst:
   - Form: cím, slug (auto-generált a címből kebab-case-re, de szerkeszthető), kategória, tartalom (Textarea, min-h-[300px]), kép feltöltés (Supabase Storage `news-images` bucket), publikált checkbox.
   - Server Action `createNews` (`src/app/admin/news/actions.ts`): Supabase insert, redirect `/admin/news`.
3. Hozd létre a `src/app/admin/news/[id]/edit/page.tsx` kliens komponenst:
   - Előre kitöltött form az aktuális hír adataival.
   - Server Action `updateNews`: Supabase update.
   - Server Action `deleteNews`: Supabase delete + kép törlés Storage-ból, redirect `/admin/news`.

---

### Iter 12.3 – Admin: Termékek CRUD
**Feladatok:**
1. Hozd létre a `src/app/admin/products/page.tsx` szerver komponenst:
   - Termékek listázása: thumbnail kép, név, ár, kategória, készlet. Szerkesztés + Törlés gomb.
   - "Új termék" gomb.
2. Hozd létre a `src/app/admin/products/new/page.tsx` kliens komponenst:
   - Form: név, ár (number), kategória, leírás (Textarea), méretek (dinamikus: "Méret hozzáadása" gombbal bővíthető input lista), készlet (number), kép feltöltés (Supabase Storage `product-images` bucket).
   - Server Action `createProduct` (`src/app/admin/products/actions.ts`): Supabase insert.
3. Hozd létre a `src/app/admin/products/[id]/edit/page.tsx`:
   - Előre kitöltött form.
   - Server Action `updateProduct` és `deleteProduct` (kép törlés Storage-ból is).

---

### Iter 12.4 – Admin: Meccs jegyek kezelése
**Feladatok:**
1. Hozd létre a `src/app/admin/matches/page.tsx` szerver komponenst:
   - `getUpcomingMatches(10)` hívás.
   - Minden meccshez Supabase-ből lekéri a `match_tickets`-eket.
   - Ha van jegy: táblázat (szektor, ár, kapacitás, eladott, szabad). Törlés gomb.
   - Ha nincs jegy: "Jegy hozzáadása" gomb.
2. Hozd létre a `src/components/admin/AddTicketForm.tsx` kliens komponenst:
   - shadcn Dialog-ban megjelenő form. Props: `apiMatchId: number`
   - 4 szektorra (Tribuna, Gol Nord, Gol Sud, Lateral): checkbox per szektor + ár input + kapacitás input.
   - Csak a bepipált szektorok kerülnek mentésre.
   - Server Action `addMatchTickets` (`src/app/admin/matches/actions.ts`): a kitöltött szektorokhoz `match_tickets` insert-ek.

---

### Iter 12.5 – Admin: Játékos leírások
**Feladatok:**
1. Hozd létre a `src/app/admin/players/page.tsx` szerver komponenst:
   - `getSquad()` hívás + Supabase `player_descriptions` összes sora.
   - Listázza a játékosokat: fotó, név, pozíció. Ha van leírás: "Szerkesztés" gomb. Ha nincs: "Leírás hozzáadása" gomb. Mindkettő link `/admin/players/[id]/edit`-re.
2. Hozd létre a `src/app/admin/players/[id]/edit/page.tsx` kliens komponenst:
   - Megjelenít: játékos neve, fotója (API-Football).
   - Textarea a leíráshoz (előre kitöltve ha volt már).
   - Server Action `upsertPlayerDescription` (`src/app/admin/players/actions.ts`): `INSERT INTO player_descriptions ... ON CONFLICT (api_player_id) DO UPDATE SET description = $2`.
   - Redirect `/admin/players` mentés után.

---

### Iter 12.6 – Admin: Szavazások CRUD + Top szavazók
**Feladatok:**
1. Hozd létre a `src/app/admin/polls/page.tsx` szerver komponenst:
   - Szavazások listája: kérdés, opciók száma, aktív-e, lejárat dátuma. Szerkesztés, Aktiválás/Deaktiválás, Törlés gombok.
   - "Új szavazás" gomb + "Top szavazók" gomb link `/admin/polls/top`-ra.
2. Hozd létre a `src/app/admin/polls/new/page.tsx` kliens komponenst:
   - Form:
     - Kérdés (text input).
     - Opciók: dinamikusan bővíthető lista ("Opció hozzáadása" gomb), minimum 2, maximum 6. Opció törölhető.
     - Helyes opció: radio group az opciók közül + "Nincs helyes válasz" opció (default).
     - Lejárat (datetime-local, opcionális).
     - Aktív checkbox (default: true).
   - Server Action `createPoll` (`src/app/admin/polls/actions.ts`): Supabase insert.
3. Hozd létre a `src/app/admin/polls/[id]/edit/page.tsx`:
   - Ha van már szavazat: kérdés és opciók readonly, csak aktív/lejárat módosítható.
   - Ha nincs szavazat: minden mező szerkeszthető.
   - Server Action `updatePoll` és `deletePoll`.
4. Hozd létre a `src/app/admin/polls/top/page.tsx` szerver komponenst:
   - Lekéri a current hónap Top 10 szavazóját:
     ```sql
     SELECT p.nickname, p.points, COUNT(pv.id) as vote_count
     FROM poll_votes pv
     JOIN profiles p ON pv.user_id = p.id
     WHERE date_trunc('month', pv.created_at) = date_trunc('month', now())
     GROUP BY p.id, p.nickname, p.points
     ORDER BY p.points DESC
     LIMIT 10
     ```
   - Táblázat: helyezés, becenév, szavazatok száma, pontszám.

---

## FÁZIS 13 – Csiszolás

### Iter 13.1 – Loading skeleton-ök
**Feladatok:**
1. Telepítsd: `npx shadcn@latest add skeleton`
2. Hozd létre a `loading.tsx` fájlokat az alábbi route-okhoz (mindegyikben a megfelelő kártya grid skeleton-jével, a shadcn `Skeleton` komponenssel):
   - `src/app/(protected)/dashboard/loading.tsx` – 3 hír skeleton + meccs skeleton
   - `src/app/(protected)/news/loading.tsx` – 9 kártya skeleton grid
   - `src/app/(protected)/players/loading.tsx` – 12 kártya skeleton grid
   - `src/app/(protected)/shop/loading.tsx` – 9 kártya skeleton grid
   - `src/app/(protected)/matches/loading.tsx` – 5 meccs skeleton

---

### Iter 13.2 – Error boundary-k + empty state-ek
**Feladatok:**
1. Hozd létre az `error.tsx` kliens komponenseket (`'use client'`, `error: Error`, `reset: () => void` props):
   - `src/app/(protected)/dashboard/error.tsx`
   - `src/app/(protected)/news/error.tsx`
   - `src/app/(protected)/matches/error.tsx`
   - Minden error.tsx tartalom: "Hiba történt" cím, `error.message`, "Próbáld újra" gomb (`reset()` hívással).
2. Üres állapot UI hozzáadása (ikon + szöveg) az alábbi helyekre ha a lista üres:
   - `NewsSection.tsx`: "Még nincsenek hírek."
   - `players/page.tsx`: "Nincs játékos a szűrési feltételek alapján."
   - `shop/page.tsx`: "Nincs termék ebben a kategóriában."

---

### Iter 13.3 – Reszponzív Navbar
**Feladatok:**
1. A `Navbar.tsx` komponenst egészítsd ki mobil hamburger menüvel:
   - `md` breakpoint felett: vízszintes nav linkek.
   - `md` alatt: hamburger gomb (Menu / X ikon, lucide-react). `useState`-tel nyitható/csukható vertikális dropdown menü.
   - Navigációs linkre kattintva a dropdown záródjon be (`router.push` + `setOpen(false)`).

---

### Iter 13.4 – SEO metadata
**Feladatok:**
1. A `src/app/layout.tsx`-ben definiáld az alap metadata-t:
   - `title: { default: 'FCB Fan Hub', template: '%s | FCB Fan Hub' }`
   - `description: 'Az FC Barcelona rajongóinak közössége'`
2. Add hozzá a `generateMetadata` async függvényt az alábbi dinamikus oldalakhoz:
   - `news/[id]/page.tsx`: title = hír `title` mezője
   - `players/[id]/page.tsx`: title = játékos neve (API-Football-ból)
   - `shop/[id]/page.tsx`: title = termék `name` mezője
   - `tickets/[matchId]/page.tsx`: title = `"Jegyvásárlás – [hazai] vs [vendég]"`

---

## Összefoglaló

| Fázis | Iterációk | Becsült komplexitás |
|---|---|---|
| 0 – Projekt alap | 3 | Alacsony |
| 1 – Auth | 3 | Alacsony |
| 2 – Landing | 2 | Alacsony |
| 3 – API-Football | 3 | Közepes |
| 4 – Dashboard | 4 | Közepes |
| 5 – Hírek | 2 | Alacsony |
| 6 – Meccsek + Jegyek | 3 | Magas |
| 7 – Játékosok | 2 | Közepes |
| 8 – Webshop | 3 | Közepes |
| 9 – Közösség | 3 | Közepes |
| 10 – Profil | 2 | Közepes |
| 11 – Chatbot | 2 | Közepes |
| 12 – Admin | 6 | Magas |
| 13 – Csiszolás | 4 | Alacsony |
| **Összesen** | **42** | |

---

## Tippek Claude Code használathoz

1. **Kontextus minden iterációhoz:** Másold be az iteráció szövegét, és add hozzá: "A stack: Next.js 14 App Router, Tailwind CSS, shadcn/ui, Supabase (`@supabase/ssr`), TypeScript."
2. **Env változók:** Sosem add meg az értékeket, csak hivatkozz a nevükre.
3. **Migrációt mindig ellenőrizd** futtatás előtt a Supabase SQL editor-ban.
4. **Ha egy iteráció túl nagynak tűnik:** Mondd meg Claude Code-nak, hogy csak az első X feladatot csinálja meg.
