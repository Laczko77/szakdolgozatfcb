# PRD – FC Barcelona Fan Webapp
**Szakdolgozat projekt | Next.js · Tailwind · Supabase**

---

## 1. Projekt összefoglaló

Egy FC Barcelona témájú rajongói webapp, amely az hivatalos fcbarcelona.com felületet veszi alapul, és azt kiegészíti interaktív szurkolói funkciókkal. A projekt célja egy teljes stack webalkalmazás bemutatása, amely lefedi az autentikációt, adatbázis-kezelést, külső API-integrációt, valós idejű kommunikációt és admin felületet.

---

## 2. Technológiai stack

| Réteg | Technológia |
|---|---|
| Frontend + Backend | Next.js 14 (App Router, Server Actions) |
| Stílus | Tailwind CSS + shadcn/ui |
| Adatbázis | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password) |
| Képtárolás | Supabase Storage |
| Valós idejű chat | Supabase Realtime |
| Meccs / statisztika adatok | **API-Football** (RapidAPI – ingyenes tier: 100 req/nap) |
| Chatbot | **Claude API** (Anthropic) |
| Fizetés | Szimulált checkout (thesis célra elegendő) |

### Miért API-Football?
Az API-Football ingyenes csomagja fedezi: La Liga meccsek (eredmények, köv. mérkőzések), játékos statisztikák, tabella. Ez azt jelenti, hogy **az admin nem kell manuálisan kezelje a meccsadatokat és játékos statisztikákat** – azok automatikusan frissülnek. Az admin csak a következőket kezeli: hírek, webshop termékek, jegyek (ár + szektor készlet), szavazások.

---

## 3. Felhasználói szerepkörök

| Szerepkör | Leírás |
|---|---|
| `guest` | Nem bejelentkezett látogató |
| `user` | Regisztrált, bejelentkezett szurkoló |
| `admin` | Tartalomkezelő adminisztrátor |

---

## 4. Oldalak és funkciók

### 4.1 Guest (nem bejelentkezett) oldalak

#### `/` – Landing Page
- Hero szekció (Barça branding, gradient háttér)
- A klubról rövid ismertető (alapítás, trófeák száma, "Més que un club")
- Ezt a fan oldalt bemutató szekció
- Feature kártyák (Hírek, Jegyek, Webshop, Közösség)
- CTA gombok: Regisztráció / Bejelentkezés
- Navbar: Logo + Regisztráció + Bejelentkezés

#### `/login` – Bejelentkezés
- Email + jelszó form
- Supabase Auth
- Redirect bejelentkezés után: `/dashboard`

#### `/register` – Regisztráció
- Teljes név, email, jelszó, becenév (opcionális – ha üres, a teljes névből generálódik)
- Supabase Auth + `profiles` tábla létrehozása

---

### 4.2 Bejelentkezett felhasználó (`/dashboard` és aloldalak)

#### `/dashboard` – Főoldal
Szekciókat tartalmaz, mindegyik "tovább" linkkel:

| Szekció | Adatforrás |
|---|---|
| Legfrissebb 3 hír | Supabase `news` tábla |
| Következő meccs (dátum, ellenfél, helyszín) | API-Football |
| Utolsó 3 meccs eredménye | API-Football |
| Barça helyzete a La Liga tabellán | API-Football |
| Top 3 játékos statisztika kártya (gólok, gólpassz) | API-Football |
| Trófeák száma (statikus szám, vizuálisan megjelenítve) | Statikus adat |
| Aktív szavazás előnézete | Supabase `polls` tábla |

#### `/news` – Hírek lista
- Kártya grid (kép, cím, dátum, rövid leírás)
- Szűrő (kategória szerint)
- Pagination

#### `/news/[id]` – Hír részletei
- Teljes cikk, kép, dátum, kategória

#### `/matches` – Meccsek
- Köv. meccsek listája (API-Football)
- Lejátszott meccsek eredményei (API-Football)
- Minden meccs kártyán: "Jegyet venni" gomb (csak köv. meccsekre, ha van hozzá jegy a DB-ben)

#### `/tickets/[matchId]` – Jegyvásárlás
- Meccs adatai (ellenfél, dátum, helyszín)
- **Stadion ülőhely térkép** (SVG alapú interaktív Camp Nou szektorábra)
  - Szektorok: Tribuna, Gol Nord, Gol Sud, Lateral
  - Kattintásra: szektorba eső helyek száma + ár megjelenítése
- Kiválasztott szektorhoz: darabszám selector + "Kosárba" gomb
- Szimulált checkout (confirm gomb → `tickets` tábla mentés, "Sikeres rendelés" modal)

#### `/players` – Játékosok
- Játékos kártyák gridje (kép, név, mez szám, pozíció) – API-Football + Supabase kép
- Szűrő pozíció szerint (Kapus, Védő, Középpályás, Támadó)

#### `/players/[id]` – Játékos részletek
- Fotó, név, mez szám, kor, állampolgárság
- Szezon statisztikák: mérkőzések, gólok, gólpassz, sárga/piros lap (API-Football)
- Rövid leírás (Supabase-ből, admin által szerkeszthető)

#### `/shop` – Webshop
- Termék kártya grid (kép, név, ár, kategória)
- Szűrő (Mez, Sapka, Sál, Kiegészítők stb.)
- Kosár funkció (localStorage alapú, egyszerű)

#### `/shop/[id]` – Termék részletek
- Nagy kép (Supabase Storage)
- Leírás, ár, méretválasztó, "Kosárba" gomb

#### `/shop/cart` – Kosár
- Tételek listája, mennyiség módosítás, összeg
- Szimulált checkout ("Rendelés leadása" → `orders` tábla)

#### `/community/polls` – Szavazások
- Aktív szavazások listája (kérdés + válaszlehetőségek)
- Ha a felhasználó már szavazott: eredmény megjelenítés (%)
- Ha nem szavazott: válasz gombokkal leadható szavazat
- **Pont rendszer**: helyes válasz esetén +10 pont a `profiles.points` mezőre
- Hónap végén Top 3 szavazó → admin által kiosztható jutalom (adminban jelölt)

#### `/community/chat` – Szurkolói chat
- Valós idejű chat (Supabase Realtime)
- Üzenetek: avatar, becenév, üzenet szövege, időbélyeg
- Szöveges input + küldés
- Legfrissebb 50 üzenet betöltve, scroll-on korábbiak

#### `/profile` – Saját profil
- Profilkép feltöltés (Supabase Storage)
- Becenév szerkesztése
- Jelszó módosítás
- Vásárlott jegyeim + rendeléseim listája
- Pontjaim megjelenítése (szavazásból)

---

### 4.3 Admin felület (`/admin/**`)
Middleware-rel védett (csak `role = admin` férhet hozzá)

#### `/admin` – Admin dashboard
- Gyors statisztikák: hírek száma, termékek száma, aktív szavazások, regisztrált felhasználók

#### `/admin/news` – Hírek kezelése
- Lista + Létrehozás / Szerkesztés / Törlés
- Kép feltöltés (Supabase Storage)
- Mezők: cím, kategória, tartalom (rich text / textarea), kép, publikálva

#### `/admin/products` – Termékek kezelése
- Lista + CRUD
- Mezők: név, ár, kategória, leírás, méret opciók, kép (Supabase Storage)

#### `/admin/matches` – Meccsek / Jegyek
- API-Football-ból automatikusan frissülő mérkőzések listája (csak nézet)
- Jegy aktiválás: adott meccshez jegy hozzáadása (szektorok, ár, kapacitás)
- Ha nincs jegy aktiválva → a meccs kártyán nem jelenik meg "Jegyet venni"

#### `/admin/players` – Játékos leírások
- API-Football-ból jönnek az alap adatok és statisztikák
- Admin csak a **leírás** mezőt szerkesztheti Supabase-ben

#### `/admin/polls` – Szavazások kezelése
- Lista + CRUD
- Mezők: kérdés, válaszlehetőségek (dinamikus), helyes válasz (opcionális), határidő, aktív-e
- Hónap végén Top 3 szavazó megtekintése (pontok alapján)

---

### 4.4 Chatbot (globális)
- Jobb alsó sarokban lebegő gomb (minden `/dashboard` alatti oldalon)
- Kattintásra chat modal nyílik
- Claude API (claude-haiku, gyors és olcsó) – rendszer prompt: "Te az FC Barcelona fan webapp asszisztense vagy..."
- Tud válaszolni: klub história, játékosok, meccsek (az oldalon szereplő adatokból), webshop, jegyvásárlás folyamata

---

## 5. Adatbázis séma (Supabase)

```sql
-- Felhasználói profilok (Supabase Auth kiegészítése)
profiles (
  id uuid PRIMARY KEY REFERENCES auth.users,
  full_name text,
  nickname text,
  avatar_url text,
  points integer DEFAULT 0,
  role text DEFAULT 'user'  -- 'user' | 'admin'
)

-- Hírek
news (
  id uuid PRIMARY KEY,
  title text,
  slug text UNIQUE,
  category text,
  content text,
  image_url text,
  published boolean DEFAULT false,
  created_at timestamptz
)

-- Termékek
products (
  id uuid PRIMARY KEY,
  name text,
  price numeric,
  category text,
  description text,
  sizes text[],
  image_url text,
  stock integer
)

-- Rendelések
orders (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles,
  items jsonb,  -- [{product_id, qty, size, price}]
  total numeric,
  status text DEFAULT 'completed',
  created_at timestamptz
)

-- Jegyek (meccsenkénti kiosztható helyek)
match_tickets (
  id uuid PRIMARY KEY,
  api_match_id integer,  -- API-Football match ID
  sector text,           -- 'tribuna' | 'gol_nord' | 'gol_sud' | 'lateral'
  price numeric,
  capacity integer,
  sold integer DEFAULT 0
)

-- Vásárolt jegyek
purchased_tickets (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles,
  match_ticket_id uuid REFERENCES match_tickets,
  quantity integer,
  created_at timestamptz
)

-- Szavazások
polls (
  id uuid PRIMARY KEY,
  question text,
  options jsonb,           -- ["Igen", "Nem", "Talán"]
  correct_option integer,  -- index (null ha nincs helyes válasz)
  expires_at timestamptz,
  is_active boolean DEFAULT true
)

-- Szavazatok
poll_votes (
  id uuid PRIMARY KEY,
  poll_id uuid REFERENCES polls,
  user_id uuid REFERENCES profiles,
  selected_option integer,
  created_at timestamptz,
  UNIQUE(poll_id, user_id)
)

-- Chat üzenetek
chat_messages (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles,
  content text,
  created_at timestamptz
)

-- Játékos leírások (API-Football kiegészítése)
player_descriptions (
  api_player_id integer PRIMARY KEY,
  description text
)
```

---

## 6. API-Football integráció

**Endpoint-ok amelyeket használunk:**

| Cél | Endpoint |
|---|---|
| Köv. meccsek | `GET /fixtures?team=529&next=5` |
| Elmúlt meccsek | `GET /fixtures?team=529&last=5` |
| La Liga tabella | `GET /standings?league=140&season=2025` |
| Játékos lista | `GET /players?team=529&season=2025` |
| Játékos statisztika | `GET /players?id={id}&season=2025` |

- Barça team ID az API-Football-ban: **529**
- La Liga league ID: **140**
- Cache: Next.js `revalidate` tag-ekkel (pl. 1 óra), hogy ne haladja meg a napi 100 kérés limitet

---

## 7. Nem megvalósított / leegyszerűsített részek

| Eredeti ötlet | Döntés | Indok |
|---|---|---|
| Valódi fizetési rendszer | Szimulált checkout | Thesis scope, Stripe integrálása nem szükséges |
| Élő meccs kommentár | Nincs | API-Football ingyenes tier nem ad live events-t |
| Email értesítések | Nincs | Scope, Supabase mail lehetséges later |
| Mobil app | Reszponzív web | Next.js reszponzív design elegendő |

---

## 8. Dizájn irányelvek

- **Színpaletta:** Barça kék (`#004D98`) és bordó/gránát (`#A50044`), arany akcentek (`#EDBB00`)
- **Tipográfia:** Inter vagy Rajdhani (sportos, modern)
- **Dark mode:** Opcionális (Tailwind dark: prefix)
- **Komponens könyvtár:** shadcn/ui (Card, Dialog, Button, Input, Badge)
- **Animációk:** Framer Motion – kártya hover, page transition
