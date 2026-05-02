# FC Barcelona Szurkolói Portál — Backend Backlog

## Scope Summary

Egy FC Barcelona szurkolói portál backend rendszere Next.js + Supabase + API-Football stack-en. A projekt lefedi az autentikációt (email + Google), hírrendszert (CMS), játékos adatbázist külső API integrációval, webshopot készletkezeléssel és demo fizetéssel, jegyrendszert szektoralapú székiosztással, közösségi feedet reakciókkal, szavazórendszert pontgyűjtéssel, pont-áruházat kuponbeváltással, cookie-alapú analitikát, valamint a teljes admin panelt. Az adatok Supabase PostgreSQL-ben élnek, a képek Supabase Storage-ban 5 külön bucketben, a jogosultságkezelés RLS policy-kkel valósul meg.

---

## Backlog Progress

| Metric              | Value |
|---------------------|-------|
| Total tasks         | 113   |
| Completed tasks     | 113   |
| Remaining tasks     | 0     |
| Completion          | 100%  |

---

## Iterations

---

### Iteration 1 — Projekt Alapok & Supabase Inicializálás

**Status:** DONE

**Goal:** A Next.js projekt felállítása, Supabase projekt összekötése, Storage bucketek létrehozása, és a teljes adatbázis-séma definiálása TypeScript típusokkal — hogy minden további iteráció stabil alapra épülhessen.

**UI required:** No

**Tasks:**

- [x] 1.1 Next.js projekt inicializálása (App Router, TypeScript, Tailwind), `npm run dev` működik
- [x] 1.2 Supabase projekt létrehozása és környezeti változók beállítása (`.env.local`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- [x] 1.3 Supabase kliens konfigurálása (`src/lib/supabase/client.ts` — böngészős kliens, `src/lib/supabase/server.ts` — szerver oldali kliens) 
- [x] 1.4 Az 5 Supabase Storage bucket létrehozása: `profile-images`, `article-images`, `player-images`, `product-images`, `post-images`
- [x] 1.5 A teljes adatbázis-séma SQL-ben történő megírása és futtatása (Supabase SQL Editorban vagy migration fájlként). A séma tartalmazza az összes táblát amit a későbbi iterációk használnak — az alábbi struktúra alapján:
**Adatbázis-séma áttekintés (1.5-ös taskhoz):**

- `profiles` — user profil adatok (id, email, username, avatar_url, role, created_at)
- `articles` — hírek/cikkek (id, title, content, category, image_url, author_id, created_at, updated_at)
- `players` — játékos adatok (id, api_football_id, name, position, number, image_url, bio, stats JSONB, season, updated_at)
- `products` — webshop termékek (id, name, description, price, image_url, category, created_at)
- `product_variants` — méret/szín variánsok (id, product_id, size, color, stock)
- `cart_items` — kosár tételek (id, user_id, variant_id, quantity)
- `orders` — rendelések (id, user_id, total_price, status, shipping_address, coupon_id, created_at)
- `order_items` — rendelés tételek (id, order_id, variant_id, quantity, unit_price)
- `reviews` — termék értékelések (id, product_id, user_id, rating, comment, is_visible, created_at)
- `wishlist` — kívánságlista (id, user_id, product_id)
- `matches` — meccsek (id, api_football_id, home_team, away_team, date, venue, status)
- `match_sectors` — szektorok meccsenként (id, match_id, sector_name, total_seats, sold_seats, price)
- `tickets` — megvásárolt jegyek (id, user_id, sector_id, seat_number, purchased_at)
- `posts` — közösségi posztok (id, author_id, content, image_url, created_at)
- `comments` — kommentek (id, post_id, user_id, content, created_at)
- `reactions` — reakciók posztokra és kommentekre (id, user_id, target_type, target_id, emoji)
- `polls` — szavazások (id, question, options JSONB, correct_option, is_active, match_id, created_at)
- `votes` — leadott szavazatok (id, poll_id, user_id, selected_option, created_at)
- `user_points` — pontegyenleg (id, user_id, balance, total_earned)
- `point_transactions` — pont tranzakciók (id, user_id, amount, reason, poll_id, created_at)
- `coupons` — pont-áruház kuponok (id, name, description, discount_type, discount_value, point_cost, is_active)
- `redeemed_coupons` — beváltott kuponok (id, user_id, coupon_id, code, is_used, redeemed_at)
- `page_views` — oldalnézettség tracking (id, user_id, page_path, product_id, cookie_id, created_at)
- `cookie_consents` — GDPR beleegyezések (id, cookie_id, consented, created_at)

- [x] 1.6 TypeScript típusok definiálása a teljes sémához (`src/types/database.ts`) — Supabase CLI `supabase gen types` parancsával vagy kézzel

**Acceptance Criteria:**

- `npm run dev` hiba nélkül fut
- A Supabase kliens csatlakozik és lekérdezések futtathatók
- Mind az 5 Storage bucket létezik és elérhető
- Az összes tábla létezik a Supabase-ben a helyes oszlopokkal és relációkkal
- A TypeScript típusok exportálva vannak és megfelelnek a séma struktúrájának

**Dependencies:** None

---

### Iteration 2 — Autentikáció & Jogosultságkezelés

**Status:** DONE

**Goal:** A teljes autentikációs rendszer felállítása Supabase Auth-tal (email/jelszó + Google), admin role kezelés, middleware védelem az `/admin` route-okra, és RLS policy-k a kritikus táblákra.

**UI required:** No (csak API/middleware réteg, a bejelentkezési form a frontend iterációban készül)

**Tasks:**

- [x] 2.1 Supabase Auth konfigurálása: email/jelszó provider engedélyezése, Google OAuth provider beállítása (Google Cloud Console-ban OAuth credentials létrehozása, redirect URL megadása)
- [x] 2.2 Auth trigger létrehozása: új regisztrációkor automatikusan létrejön egy sor a `profiles` táblában (Supabase Database Function + Trigger az `auth.users` INSERT-re), default `role = 'user'`
- [x] 2.3 Next.js middleware implementálása (`src/middleware.ts`): az `/admin/*` route-okra csak `admin` role-ú userek férhetnek hozzá, mindenki mást redirect a főoldalra
- [x] 2.4 RLS policy-k beállítása az alapvető táblákra:
  - `profiles`: user csak a sajátját olvashatja/módosíthatja, admin mindent
  - `articles`: bárki olvashat, csak admin írhat/módosíthat/törölhet
  - `products` és `product_variants`: bárki olvashat, csak admin módosíthat
- [x] 2.5 Segédfüggvények létrehozása (`src/lib/auth.ts`): `getCurrentUser()`, `isAdmin()`, `requireAdmin()` — szerveroldali route-okhoz

**Acceptance Criteria:**

- Email + jelszóval regisztráció és bejelentkezés működik
- Google OAuth login működik, első belépéskor profil automatikusan létrejön
- Nem-admin user az `/admin` route-okra navigálva visszairányítódik
- Admin user eléri az `/admin` route-okat
- RLS policy-k működnek: normál user nem tud közvetlenül módosítani admin-only táblákat

**Dependencies:** Iteration 1

---

### Iteration 3 — Hírrendszer (CMS) Backend

**Status:** DONE

**Goal:** A hírrendszer teljes backend logikája: admin tud cikkeket létrehozni, szerkeszteni, törölni képfeltöltéssel, a userek tudják listázni és olvasni a cikkeket kategória szerint szűrve.

**UI required:** No

**Tasks:**

- [x] 3.1 Admin API route-ok létrehozása a cikkek kezelésére (`src/app/api/articles/`):
  - `POST /api/articles` — új cikk létrehozása (title, content, category, image)
  - `PUT /api/articles/[id]` — cikk szerkesztése
  - `DELETE /api/articles/[id]` — cikk törlése
- [x] 3.2 Képfeltöltés implementálása az `article-images` bucketbe: a kép URL-je mentődik az `articles` táblába
- [x] 3.3 Publikus API route-ok:
  - `GET /api/articles` — cikkek listázása (lapozás, kategória szűrés)
  - `GET /api/articles/[id]` — egy cikk részletei
- [x] 3.4 Kategória rendszer: fix kategóriák definiálása (pl. 'transfers', 'match-report', 'interview', 'news') TypeScript enum-ként (RLS funkcionálisan a 004_rls_policies.sql migráció által lefedve)

**Acceptance Criteria:**

- Admin tud cikket létrehozni képpel, szerkeszteni és törölni
- Törléskor a kép is törlődik a Storage-ból
- Publikus endpoint lapozottan visszaadja a cikkeket, szűrhető kategóriára
- Nem-admin user a POST/PUT/DELETE endpoint-okra 403-at kap

**Dependencies:** Iteration 2 

---

### Iteration 4 — Játékos Adatbázis & API-Football Integráció

**Status:** DONE

**Goal:** A játékos adatbázis felépítése, az API-Football integráció megvalósítása admin-indított szinkronizációval, és a publikus lekérdezési endpoint-ok elkészítése.

**UI required:** No

**Tasks:**

- [x] 4.1 API-Football kliens modul létrehozása (`src/lib/api-football.ts`): API kulcs kezelés, alap fetch wrapper, rate limiting figyelembevétele (napi 100 request limit)
- [x] 4.2 Admin szinkronizációs endpoint (`POST /api/admin/players/sync`): lekéri az FC Barcelona aktuális keretét az API-Football-ból, és upsert-eli a `players` táblába (név, pozíció, szám, kép, statisztikák). Csak az aktuális szezon adatai
- [x] 4.3 Admin kézi szerkesztő endpoint (`PUT /api/admin/players/[id]`): az admin tud bio-t írni, képet módosítani, egyedi mezőket szerkeszteni
- [x] 4.4 Publikus endpoint-ok:
  - `GET /api/players` — teljes keret listázása (szűrhető pozíció szerint)
  - `GET /api/players/[id]` — egy játékos részletes adatai statisztikákkal
- [x] 4.5 API-Football environment variable beállítása (`API_FOOTBALL_KEY`), FC Barcelona `team_id = 529` rögzítése konstansként, és a szinkronizáció logolása (hány játékos frissítve, hibák)

**Acceptance Criteria:** 

- A szinkronizációs endpoint sikeresen lekéri és elmenti az FC Barcelona játékosait
- A statisztikák (gólok, gólpasszok, meccsek, sárga/piros lapok) megfelelően tárolódnak a JSONB mezőben
- Játékos képek az API-ból jönnek és mentődnek
- Admin tud kézzel bio-t és egyéb adatot szerkeszteni anélkül, hogy a következő szinkronizáció felülírná
- A publikus endpoint-ok helyesen visszaadják az adatokat

**Dependencies:** Iteration 2

---

### Iteration 5 — Webshop Backend (Termékek, Kosár, Rendelés)

**Status:** DONE

**Goal:** A webshop teljes backend logikája: termékkezelés variánsokkal és készlettel, kosár működés, demo checkout flow, rendeléskezelés és szállítási státuszok.

**UI required:** No

**Tasks:**

- [x] 5.1 Admin termékkezelő endpoint-ok (`src/app/api/admin/products/`):
  - `POST /api/admin/products` — új termék létrehozása variánsokkal (méretek, készlet), képfeltöltéssel a `product-images` bucketbe
  - `PUT /api/admin/products/[id]` — termék szerkesztése
  - `DELETE /api/admin/products/[id]` — termék törlése
  - `PUT /api/admin/products/[id]/variants` — variánsok készletének frissítése
- [x] 5.2 Publikus termék endpoint-ok:
  - `GET /api/products` — termékek listázása (lapozás, kategória szűrés, keresés)
  - `GET /api/products/[id]` — termék részletei variánsokkal és átlagos értékeléssel
- [x] 5.3 Kosár endpoint-ok (`src/app/api/cart/`):
  - `GET /api/cart` — aktuális kosár tartalma
  - `POST /api/cart` — tétel hozzáadása (variant_id, quantity), készletellenőrzéssel
  - `PUT /api/cart/[id]` — mennyiség módosítása
  - `DELETE /api/cart/[id]` — tétel eltávolítása
- [x] 5.4 Rendelés endpoint-ok (`src/app/api/orders/`):
  - `POST /api/orders` — demo checkout: kosárból rendelés létrehozása, készlet csökkentése, kosár ürítése, opcionális kupon alkalmazása
  - `GET /api/orders` — user saját rendeléseinek listázása
  - `DELETE /api/orders/[id]` — rendelés lemondása (csak ha status != 'shipped')
- [x] 5.5 Admin rendeléskezelő:
  - `GET /api/admin/orders` — összes rendelés listázása (szűrhető státuszra)
  - `PUT /api/admin/orders/[id]/status` — státusz módosítása (processing → shipped → delivered)
- [x] 5.6 Wishlist endpoint-ok:
  - `GET /api/wishlist` — user kívánságlistája
  - `POST /api/wishlist` — termék hozzáadása
  - `DELETE /api/wishlist/[id]` — termék eltávolítása
- [x] 5.7 Értékelés endpoint-ok:
  - `POST /api/products/[id]/reviews` — értékelés írása (1-5 csillag + szöveg), egy user csak egyszer értékelhet egy terméket
  - `GET /api/products/[id]/reviews` — értékelések listázása (csak `is_visible = true`)
  - `PUT /api/admin/reviews/[id]` — admin moderáció (is_visible toggle)

**Acceptance Criteria:**

- Admin tud terméket létrehozni méretekkel, készlettel és képpel
- Kosárba csak készleten lévő termék tehető, a mennyiség nem haladhatja meg a készletet
- Demo checkout létrehozza a rendelést, csökkenti a készletet, üríti a kosarat
- Rendelés lemondható amíg a státusz nem 'shipped'
- Admin tudja a szállítási státuszt léptetni
- Értékeléseket az admin tudja moderálni (elrejteni/megjeleníteni)
- Wishlist CRUD működik, egy terméket csak egyszer lehet felvenni

**Dependencies:** Iteration 2

---

### Iteration 6 — Jegyrendszer Backend

**Status:** DONE

**Goal:** A jegyrendszer backend logikája: meccsek szinkronizálása az API-Football-ból, admin szektorkezelés, jegyvásárlás automatikus székiosztással és vásárlási limittel.

**UI required:** No

**Tasks:**

- [x] 6.1 Meccs szinkronizációs endpoint (`POST /api/admin/matches/sync`): az API-Football-ból lekéri az FC Barcelona következő meccseit és upsert-eli a `matches` táblába
- [x] 6.2 Admin szektorkezelő endpoint-ok:
  - `POST /api/admin/matches/[id]/sectors` — szektorok létrehozása egy meccshez (sector_name, total_seats, price)
  - `PUT /api/admin/matches/[id]/sectors/[sectorId]` — szektor módosítása (pl. extra jegyek hozzáadása: total_seats növelése)
- [x] 6.3 Publikus endpoint-ok:
  - `GET /api/matches` — közelgő meccsek listázása
  - `GET /api/matches/[id]` — meccs részletei szektorokkal és szabad helyek számával
- [x] 6.4 Jegyvásárlás endpoint (`POST /api/tickets/purchase`):
  - Bemenet: match_id, sector_id, quantity (1-4)
  - Ellenőrzések: max 4 jegy/user/meccs, van-e elég szabad hely a szektorban
  - Automatikus székszám kiosztás (következő szabad szám)
  - `sold_seats` növelése a szektorban, ha elérte a `total_seats`-et, a szektor lezár
- [x] 6.5 User jegy endpoint-ok:
  - `GET /api/tickets` — user saját jegyeinek listázása (közelgő és múltbeli meccsek)

**Acceptance Criteria:**

- Meccsek sikeresen szinkronizálódnak az API-Football-ból
- Admin tud szektorokat létrehozni és bővíteni
- Jegyvásárlásnál a 4 jegy/user/meccs limit érvényesül
- Ha egy szektor betelt, nem lehet több jegyet venni rá
- A székszám automatikusan osztódik ki
- User látja a saját jegyeit a profiljában

**Dependencies:** Iteration 4 (API-Football kliens)

---

### Iteration 7 — Profilkezelés & Globális Kereső

**Status:** DONE

**Goal:** A profiloldal backend logikája (adatmódosítás, profilkép, vásárlási előzmények) és a globális kereső ami több táblában keres egyszerre.

**UI required:** No

**Tasks:**

- [x] 7.1 Profil endpoint-ok (`src/app/api/profile/`):
  - `GET /api/profile` — bejelentkezett user profil adatai
  - `PUT /api/profile` — username és avatar módosítása (kép feltöltés a `profile-images` bucketbe)
  - `PUT /api/profile/password` — jelszóváltoztatás (Supabase Auth `updateUser`)
- [x] 7.2 Vásárlási előzmények aggregáció:
  - `GET /api/profile/purchases` — rendelések és jegyek együttes listázása, időrend szerint
- [x] 7.3 Pontegyenleg endpoint:
  - `GET /api/profile/points` — aktuális pontegyenleg és tranzakció-történet
- [x] 7.4 Globális kereső endpoint (`GET /api/search?q=...`):
  - Keres az `articles` (title, content), `products` (name, description), `players` (name), és `posts` (content) táblákban
  - Supabase full-text search (`to_tsvector` / `plainto_tsquery`) vagy ILIKE fallback
  - Eredményeket típus szerint csoportosítva adja vissza (articles: [...], products: [...], players: [...], posts: [...])

**Acceptance Criteria:**

- User tud usernevet és profilképet módosítani
- Jelszóváltoztatás működik Supabase Auth-on keresztül
- A vásárlási előzmények tartalmazzák a webshop rendeléseket és a jegyeket is
- A globális kereső releváns eredményeket ad vissza több táblából
- A keresés kezeli az üres query-t és a nincs találat esetet

**Dependencies:** Iteration 5, Iteration 6

---

### Iteration 8 — Közösségi Feed Backend

**Status:** DONE

**Goal:** A közösségi feed teljes backend logikája: admin posztok, user kommentek, emoji reakciók posztokra és kommentekre, népszerűségi rendezés, és a kommentek moderálása.

**UI required:** No

**Tasks:**

- [x] 8.1 Poszt endpoint-ok:
  - `POST /api/admin/posts` — admin poszt létrehozása (content, image feltöltés a `post-images` bucketbe)
  - `PUT /api/admin/posts/[id]` — poszt szerkesztése
  - `DELETE /api/admin/posts/[id]` — poszt törlése
  - `GET /api/posts` — posztok listázása (lapozás, legújabb elöl), minden poszthoz: reakció-összesítő és kommentek száma
- [x] 8.2 Komment endpoint-ok:
  - `POST /api/posts/[id]/comments` — komment írása
  - `DELETE /api/comments/[id]` — saját komment törlése (vagy admin bármelyiket)
  - `GET /api/posts/[id]/comments` — kommentek listázása népszerűségi sorrendben (reakciók száma alapján)
- [x] 8.3 Reakció endpoint-ok:
  - `POST /api/reactions` — reakció hozzáadása (target_type: 'post' | 'comment', target_id, emoji)
  - `DELETE /api/reactions/[id]` — reakció visszavonása
  - Egy user egy target-re csak egyféle reakciót adhat; ha másikat ad, az előző cserélődik
- [x] 8.4 Admin moderáció:
  - `DELETE /api/admin/comments/[id]` — bármely komment törlése
- [x] 8.5 Polling endpoint optimalizálás: a `GET /api/posts` endpoint támogasson `since` paramétert (timestamp), hogy a 3 mp-es polling csak az új/módosult posztokat kérje le

**Acceptance Criteria:**

- Admin tud posztot létrehozni, szerkeszteni, törölni képpel
- Userek tudnak kommentelni és saját kommentjüket törölni
- Reakciók működnek posztokra és kommentekre egyaránt
- Kommentek népszerűségi sorrendben jönnek (legtöbb reakció elöl)
- A polling endpoint hatékonyan csak az új adatokat adja vissza
- Admin bármely kommentet moderálhatja

**Dependencies:** Iteration 2

---

### Iteration 9 — Szavazórendszer & Pontrendszer

**Status:** DONE

**Goal:** A szavazórendszer backend logikája: admin szavazás-létrehozás, userek szavaznak, az admin beállítja a helyes választ, és a rendszer automatikusan szétosztja a pontokat a nyerteseknek.

**UI required:** No

**Tasks:**

- [x] 9.1 Admin szavazás endpoint-ok:
  - `POST /api/admin/polls` — szavazás létrehozása (question, options tömb, opcionális match_id)
  - `PUT /api/admin/polls/[id]` — szavazás szerkesztése
  - `PUT /api/admin/polls/[id]/resolve` — helyes válasz beállítása: `correct_option` mező kitöltése, `is_active = false`, és automatikus pontszétosztás a helyes szavazóknak (fix 50 pont) — atomic RPC
  - `DELETE /api/admin/polls/[id]` — szavazás törlése
- [x] 9.2 User szavazás endpoint-ok:
  - `GET /api/polls` — aktív szavazások listázása (is_active = true) + lezárt szavazások eredményei (`GET /api/polls/[id]/results`)
  - `POST /api/polls/[id]/vote` — szavazat leadása (egy user csak egyszer szavazhat)
  - `GET /api/polls/[id]/results` — szavazás eredményei (opciónkénti szavazatszám, helyes válasz ha lezárult)
- [x] 9.3 Pontszétosztás logika (`src/lib/points.ts`):
  - A `resolve` endpoint hívásakor: lekéri az összes helyes szavazatot, minden nyertes `user_points.balance`-ét növeli 50-nel, és `point_transactions`-be bejegyzi a tranzakciót — `poll_results` view, `resolve_poll` RPC
  - Tranzakcionális végrehajtás (Supabase RPC vagy database function)

**Acceptance Criteria:**

- Admin tud szavazást létrehozni és lezárni helyes válasszal
- Lezáráskor a pontok automatikusan és helyesen szétosztódnak
- Egy user nem szavazhat kétszer ugyanarra a szavazásra
- A pontegyenleg és tranzakciók nyomon követhetők
- Aktív és lezárt szavazások külön kezelhetők

**Dependencies:** Iteration 2

---

### Iteration 10 — Pont-Áruház & Kuponrendszer

**Status:** DONE

**Goal:** A pont-áruház backend logikája: az admin kuponokat hoz létre különböző pontértékekhez, a userek beváltják pontjaikból, és a kuponokat felhasználják a webshop/jegy checkout-ban.

**UI required:** No

**Tasks:**

- [x] 10.1 Admin kupon endpoint-ok:
  - `POST /api/admin/coupons` — kupon létrehozása (name, description, discount_type: 'percentage' | 'fixed' | 'free_shipping', discount_value, point_cost)
  - `PUT /api/admin/coupons/[id]` — kupon szerkesztése
  - `DELETE /api/admin/coupons/[id]` — kupon deaktiválása (soft delete: is_active=false)
  - `GET /api/admin/coupons` — összes kupon listázása statisztikákkal (`coupon_redeem_stats` view)
- [x] 10.2 User pont-áruház endpoint-ok:
  - `GET /api/shop/coupons` — elérhető kuponok listázása (is_active = true)
  - `POST /api/shop/coupons/[id]/redeem` — `redeem_coupon` RPC: atomic pont-csökkentés + `BARCA-XXXX-XXXX` kódgenerálás
  - `GET /api/profile/coupons` — user beváltott kuponjai (is_used szűréssel)
- [x] 10.3 Checkout integráció: `POST /api/orders` és `POST /api/tickets/purchase` fogadja a `coupon_code` paramétert — `apply_coupon_to_order` / `consume_coupon` RPC-k atomic módon validálnak + `is_used = true`-ra állítják

**Acceptance Criteria:**

- Admin tud kuponokat létrehozni különböző típusokkal és pontértékekkel
- User csak akkor tud beváltani, ha van elég pontja
- Beváltáskor egyedi kuponkód generálódik
- A kupon kód alkalmazható a webshop és jegy checkout-ban
- Egy kuponkód csak egyszer használható fel
- Felhasználás után `is_used = true`-ra vált

**Dependencies:** Iteration 9, Iteration 5, Iteration 6

---

### Iteration 11 — Cookie Tracking & Admin Analitika

**Status:** DONE

**Goal:** Cookie-alapú user tracking megvalósítása GDPR consent kezeléssel, oldal- és terméknézettség rögzítése, és admin analitika endpoint-ok az adatvezérelt döntésekhez.

**UI required:** No (a consent banner a frontend iterációban készül, itt a backend logika)

**Tasks:**

- [x] 11.1 Cookie consent endpoint-ok:
  - `POST /api/consent` — GDPR beleegyezés rögzítése (cookie_id generálás, consented: true/false)
  - A cookie_id egy UUID amit a böngészőben tárolunk, és minden tracking requesthez csatolunk
- [x] 11.2 Page view tracking endpoint:
  - `POST /api/tracking/pageview` — oldalnézettség rögzítése (page_path, opcionális product_id, cookie_id). Csak akkor rögzít, ha a cookie_id-hoz tartozó consent = true
- [x] 11.3 Admin analitika endpoint-ok (`src/app/api/admin/analytics/`):
  - `GET /api/admin/analytics/pages` — legnézettebb oldalak (top 20, időszak szűréssel)
  - `GET /api/admin/analytics/products` — legnézettebb termékek (top 20)
  - `GET /api/admin/analytics/overview` — összesített statisztikák (összes user, összes rendelés, összes bevétel, aktív szavazások)
- [x] 11.4 Termékajánlás endpoint:
  - `GET /api/products/recommended` — a legnézettebb / legjobban értékelt termékek visszaadása, amit az admin kiemelt ajánlásként tud használni

**Acceptance Criteria:**

- Cookie consent rögzítődik, és csak beleegyezés esetén történik tracking
- Oldal- és terméknézettség adatok gyűlnek a `page_views` táblában
- Admin dashboard endpoint-ok helyes aggregált adatokat adnak vissza
- A termékajánlás endpoint a nézettségi adatok alapján rangsorol
- GDPR-kompatibilis: consent nélkül nem rögzítődik adat

**Dependencies:** Iteration 2

---

### Iteration 12 — RLS Policy-k, Végső Biztonsági Réteg & Integráció

**Status:** DONE

**Goal:** Az összes Supabase tábla RLS policy-jének véglegesítése, az edge case-ek kezelése, és a teljes backend end-to-end tesztelése az összes modul együttműködésével.

**UI required:** No

**Tasks:**

- [x] 12.1 Minden tábla RLS policy-jének felülvizsgálata és véglegesítése:
  - `cart_items`, `orders`, `order_items`: user csak a sajátját látja/módosítja
  - `tickets`: user csak a sajátját látja
  - `comments`, `reactions`: user a sajátját törölheti, bárki olvashat
  - `votes`: user a sajátját olvashatja, létrehozhat, de nem módosíthat
  - `user_points`, `point_transactions`, `redeemed_coupons`: user csak a sajátját látja
  - `page_views`, `cookie_consents`: insert bárki, read csak admin
- [x] 12.2 Edge case-ek kezelése:
  - Race condition a jegyvásárlásnál (két user egyszerre veszi az utolsó jegyet) — Supabase RPC-vel tranzakcionális kezelés
  - Race condition a készletcsökkentésnél checkout-nál
  - Dupla kattintás védelem a szavazásnál és rendelésnél
- [x] 12.3 API rate limiting megfontolások: a polling endpoint-oknál gondoskodni a hatékonyságról
- [x] 12.4 End-to-end manuális teszt: a teljes user journey végigpróbálása (regisztráció → böngészés → vásárlás → szavazás → pont beváltás → kupon használat)

**Acceptance Criteria:**

- Egyetlen tábla sem érhető el RLS nélkül
- Race condition-ök kezelve vannak tranzakciókkal
- A teljes user journey hiba nélkül végigfut
- Admin journey is végigfut (cikk → termék → szektor → poszt → szavazás → lezárás → analitika)

**Dependencies:** Iteration 3–11 (mind)

---

### Iteration 13 — Átállás football-data.org API-ra (API-Football kiváltása)

**Status:** DONE

**Goal:** Az API-Football integráció teljes kiváltása a football-data.org API-val. A football-data.org adja a keretet, a meccseket (csapat logókkal együtt) és a játékos statisztikákat (a `scorers` endpointon keresztül). A játékos képek manuálisan, az admin panelen kerülnek feltöltésre — semmilyen automatikus képszinkronizáció nem fut. A meglévő admin szinkronizációs endpoint-ok belső logikája változik, a publikus API-k interfésze változatlan marad, az adatbázis-séma kiegészül a meccs csapat-logó URL oszlopokkal.

**UI required:** No

**Tasks:**

- [x] 13.1 `football-data.ts` modul létrehozása (`src/lib/football-data.ts`):
  - Base URL: `https://api.football-data.org/v4`, autentikáció `X-Auth-Token` header-rel a `FOOTBALL_DATA_API_KEY` env var-ból
  - FC Barcelona team ID: `81` konstansként
  - Rate limiting: a football-data.org free tier 10 hívás/perc limitet enged — egyszerű in-memory throttle/queue, hogy a szinkronizáció ne fusson rate limitbe
  - `getSquad()` függvény: `GET /teams/81` hívás, visszaadja a `squad[]` tömböt (mezőnként: `id`, `name`, `position` — Goalkeeper/Defence/Midfield/Offence, `shirtNumber`, `dateOfBirth`, `nationality`)
  - `getMatches(season: number)` függvény: `GET /teams/81/matches?season=<season>` hívás (a `season` paraméter a szezon **kezdő** éve, pl. `2025` = 2025/26 szezon, **NEM** a végső év). Visszaadja a `matches[]` tömböt minden meccshez: `id`, `utcDate`, `status`, `homeTeam.name`, `homeTeam.crest` (logo URL!), `awayTeam.name`, `awayTeam.crest` (logo URL!), `score.fullTime`, `competition.name`. Megjegyzés: a `venue` mező MINDIG `null` ezen az endpointon, ezt nem szabad várni
  - `getScorers(competitionId: number, season: number)` függvény: `GET /competitions/{competitionId}/scorers?season=<season>` hívás. Visszaadja a `scorers[]` tömböt minden gólszerzőhöz: `player.id`, `player.name`, `goals`, `assists`, `playedMatches`. Mindkét bajnokságra (La Liga: `2014`, BL: `2001`) lekérve és FC Barcelona játékosaira szűrve adja a per-player statisztikákat
  - Status értékek normalizálása: `SCHEDULED`, `TIMED`, `FINISHED`, `LIVE`, `IN_PLAY`, `PAUSED`, `POSTPONED`, `CANCELLED`, `AWARDED`
  - Hibakezelés: timeout, HTTP hibák, rate limit (429) esetén értelmes Error-ok dobása
- [x] 13.2 Adatbázis migráció: új TEXT NULL oszlopok a `matches` táblához (`supabase/migrations/<dátum>_matches_team_crests.sql`):
  - `home_team_crest TEXT NULL` — a hazai csapat logó URL-je (a football-data.org `homeTeam.crest` mezőjéből)
  - `away_team_crest TEXT NULL` — a vendég csapat logó URL-je (a football-data.org `awayTeam.crest` mezőjéből)
  - A `src/types/database.ts` típusok kiegészítése a két új mezővel
- [x] 13.3 `POST /api/admin/players/sync` átírása:
  - Az API-Football hívás cserélése a `getSquad()` hívásra
  - A `squad[]` minden eleméből upsert a `players` táblába: `name`, `position` (a football-data.org pozíciók map-elése a meglévő pozíció rendszerre), `number` (`shirtNumber`), `season` (kezdő év)
  - **Statisztikák lekérése**: a `getScorers(competitionId, season)` függvény hívása a `GET /competitions/{id}/scorers?season=2025` endpointon, mindkét bajnokságra (La Liga competition ID: `2014`, Bajnokok Ligája competition ID: `2001`). A scorers listából az FC Barcelona játékosainak azonosítása a player ID alapján, és a `players.stats` JSONB mező feltöltése: `{ goals, assists, playedMatches, yellowCards: 0, redCards: 0 }`. Az összesített statisztikák (La Liga + BL együtt) tárolódnak. **Megjegyzés:** a sárga/piros lapok a scorers API-ból nem elérhetők, ezért `0`-ként tárolódnak — ezt a viselkedést logolni kell (info level)
  - Játékos képek: NINCS automatikus képszinkronizáció. A képeket az admin manuálisan tölti fel az admin paneles játékos szerkesztő felületen (`PUT /api/admin/players/[id]` endpoint). A szinkronizáció a `image_url` mezőt nem érinti
  - A kézi admin szerkesztések (bio, kép, egyedi mezők) továbbra sem íródnak felül szinkronizációkor
- [x] 13.4 `POST /api/admin/matches/sync` átírása:
  - Az API-Football hívás cserélése a `getMatches(season)` hívásra
  - A `matches[]` minden eleméből upsert a `matches` táblába: `home_team` (`homeTeam.name`), `away_team` (`awayTeam.name`), `home_team_crest` (`homeTeam.crest`), `away_team_crest` (`awayTeam.crest`), `date` (`utcDate`), `status` (a normalizált status), `competition` (`competition.name`)
  - **Megjegyzés**: a `venue` mező a football-data.org-tól mindig `null`, ezért az adatbázisban marad NULL. Ezt elfogadjuk — a stadion neve nem kritikus a jegyrendszerhez
- [x] 13.5 API-Football kliens eltávolítása:
  - `src/lib/api-football.ts` fájl törlése
  - `API_FOOTBALL_KEY` environment variable eltávolítása a `.env.local`-ból és minden dokumentációból (README, .env.example, CLAUDE.md ha hivatkozik rá)
  - Minden `api-football` import eltávolítása a kódbázisból
- [x] 13.6 Hibakezelés és logging: a szinkronizáció minden futásnál logoljon (hány játékos/meccs frissítve, hány játékos statisztikája frissült a scorers API-ból, rate limit állapot, hibák listája, futásidő). Ha a football-data.org nem elérhető vagy hibát ad, az endpoint adjon vissza értelmes hibaüzenetet az adminnak, és ne írja felül a meglévő adatokat. A scraper fájlok (`src/lib/scraper/`) törölhetők — ezeket az új flow nem használja

**Acceptance Criteria:**

- A `POST /api/admin/players/sync` endpoint sikeresen lekéri és elmenti az FC Barcelona teljes keretét a football-data.org-ról
- A `POST /api/admin/matches/sync` endpoint sikeresen lekéri a meccseket csapat logókkal együtt
- A `matches` táblában megjelennek a `home_team_crest` és `away_team_crest` URL-ek a frissen szinkronizált meccseknél
- A szinkronizált játékosok `stats` mezője tartalmazza a gólok, gólpasszok és lejátszott meccsek számát a football-data.org scorers API-ból (La Liga + BL összesítve), a sárga/piros lapok 0-ként tárolva
- A publikus endpoint-ok (`GET /api/players`, `GET /api/players/[id]`, `GET /api/matches`, `GET /api/matches/[id]`) interfész szinten változatlanul működnek (a meccs response-ok mostantól tartalmazzák a logo URL-eket)
- A játékos képek manuálisan, az admin panelen kerülnek feltöltésre (`PUT /api/admin/players/[id]`); a szinkronizáció nem érinti az `image_url` mezőt
- Az admin kézi szerkesztései (bio, kép, egyedi adatok) megmaradnak szinkronizáció után is
- Az `api-football.ts` modul és az `API_FOOTBALL_KEY` environment variable teljesen eltávolításra került
- A football-data.org rate limit (10 hívás/perc) tiszteletben tartva, a szinkronizáció nem fut bele 429-be
- A `season` paraméter helyesen kezeli a kezdő évet (2025 = 2025/26 szezon)

**Dependencies:** Iteration 1 (Supabase séma), Iteration 2 (Auth, admin védelem)

---

### Iteration 14 — Kritikus Bug Fixek (Backend)

**Status:** DONE

**Goal:** Az éles használat során feltárt kritikus backend hibák kijavítása: a játékos statisztika lekérdezés inkonzisztenciája, a shop termék értékelés aggregáció hibája, és a kupon beváltás 500-as hibája.

**UI required:** No

**Tasks:**

- [x] 14.1 Játékos statisztikák API javítás (#1):
  - A `GET /api/players` és `GET /api/players/[id]` endpointok ellenőrzése: a `stats` JSONB mező konzisztensen tartalmazza a `goals`, `assists`, `playedMatches`, `yellowCards`, `redCards` kulcsokat
  - Ha hiányzó kulcs van (pl. régi sync-ből származó adat), default 0 értéket adjon vissza a response payload szinten (ne csak nullable legyen)
  - Logging: ha egy játékosnak teljesen üres a stats mezője, info log
- [x] 14.2 Shop termék értékelés aggregáció javítás (#2):
  - A `GET /api/products/[id]` response-ban a `average_rating` és `review_count` mezők helyes számolása csak a `is_visible = true` értékelésekből
  - Edge case: nulla értékelés esetén `average_rating = null` (vagy 0), nem dob hibát
  - SQL query optimalizáció: aggregált subquery vagy view használata, hogy ne legyen N+1 lekérdezés terméklistán
- [x] 14.3 Kupon beváltás 500-as hiba javítás (#4):
  - A `POST /api/shop/coupons/[id]/redeem` endpoint hibakezelése: ha az atomic RPC (`redeem_coupon`) hibát ad, értelmes 400/409 státusz térjen vissza (pl. "nincs elég pont", "már beváltott", "kupon nem aktív") — ne 500
  - A `redeem_coupon` RPC kódjának átnézése: try/catch helyett tiszta exit feltételek
  - Logging: a hiba root cause logolása szerveroldalon
- [x] 14.4 Regressziós tesztelés: a három javított endpoint manuális tesztelése a development környezetben, edge case-ek lefedése

**Acceptance Criteria:**

- A játékos endpointok konzisztens stats objektumot adnak vissza minden mezővel
- A shop termék lista és detail oldalon az átlagos értékelés és értékelés-szám helyes
- A kupon beváltás minden hibás kérés esetén 4xx státuszt ad vissza, nem 500-at
- Sikeres beváltás továbbra is működik
- A logok tartalmazzák a hibás esetek root cause-át

**Dependencies:** Iteration 4, Iteration 5, Iteration 10

---

### Iteration 15 — Dashboard: La Liga Tabella & Góllövőlista API

**Status:** DONE

**Goal:** A dashboard widget-ekhez szükséges La Liga állás és góllövőlista API endpointok megvalósítása a football-data.org wrapperen keresztül, in-memory vagy Supabase-alapú cache-eléssel hogy a 10 hívás/perc rate limit ne legyen érintve.

**UI required:** No

**Tasks:**

- [x] 15.1 `getStandings(competitionId, season)` függvény hozzáadása `src/lib/football-data.ts`-hez:
  - `GET /competitions/{competitionId}/standings?season=<season>` hívás
  - Visszaadja a `standings[]` tömböt (TOTAL típusú álláshoz): minden csapatra `position`, `team.id`, `team.name`, `team.crest`, `playedGames`, `won`, `draw`, `lost`, `points`, `goalsFor`, `goalsAgainst`, `goalDifference`
  - La Liga competition ID: `2014`
  - Hibakezelés és rate limit tisztelet (a meglévő throttle/queue logikán keresztül)
- [x] 15.2 `GET /api/standings` publikus endpoint:
  - Query param: `competition` (default: `2014` La Liga), `season` (default: aktuális szezon kezdő éve)
  - Cache stratégia: vagy Supabase tábla (`standings_cache` — competition_id, season, data JSONB, fetched_at) vagy in-memory Map TTL-lel (12 óra)
  - Cache miss esetén `getStandings()` hívás, sikeres válasz után cache mentés
  - Response: az állás tömb a 15.1-ben definiált struktúrával
- [x] 15.3 `GET /api/scorers` publikus endpoint:
  - Query param: `competition` (default: `2014` La Liga), `season`, `limit` (default: 10)
  - Cache stratégia: ugyanaz mint a 15.2-nél (`scorers_cache` tábla vagy in-memory)
  - A meglévő `getScorers()` függvényt használja
  - Response: top N gólszerző (player.id, player.name, team.name, goals, assists, playedMatches)
- [x] 15.4 Cache invalidálás admin endpoint (opcionális, biztonsági háló):
  - `POST /api/admin/standings/refresh` és `POST /api/admin/scorers/refresh` — admin manuálisan triggerelheti a cache frissítést
- [x] 15.5 Cache séma migráció (ha Supabase tábla a választás): `supabase/migrations/<dátum>_standings_scorers_cache.sql`:
  - `standings_cache` tábla: `id` (PK), `competition_id` (int), `season` (int), `data` (JSONB), `fetched_at` (timestamptz), unique (competition_id, season)
  - `scorers_cache` tábla: hasonló struktúra
  - RLS: read mindenkinek (vagy csak service role), write csak service role

**Acceptance Criteria:**

- A `GET /api/standings` endpoint helyesen visszaadja a La Liga aktuális állását
- A `GET /api/scorers` endpoint visszaadja a top gólszerzőket
- A cache működik: ismételt hívások nem terhelik a football-data.org-t (rate limit alatt maradunk)
- A cache TTL utáni hívás frissít
- A frontend dashboard widget tudja fogyasztani az adatokat

**Dependencies:** Iteration 13 (football-data.org wrapper)

---

### Iteration 16 — Jegyrendszer: Fix Szektor Architektúra

**Status:** DONE

**Goal:** A jegyrendszer szektor logikájának átalakítása: dinamikus admin által létrehozott szektorok helyett 4 fix szektor (TRIBUNA, LATERAL, GOL NORD, GOL SUD) automatikus seed-elése minden meccshez. Az admin csak az árat és a kapacitást módosíthatja, új szektort nem hozhat létre. A meglévő szektorok és jegyek törlésre kerülnek (teszt fázis).

**UI required:** No

**Tasks:**

- [x] 16.1 Adatbázis migráció: meglévő szektorok és jegyek törlése + sémabővítés (`supabase/migrations/<dátum>_fixed_sectors.sql`):
  - `DELETE FROM tickets`; `DELETE FROM match_sectors;` (teszt fázis, jegyek törölhetők)
  - Új constants/enum a szektor nevekre: `TRIBUNA`, `LATERAL`, `GOL NORD`, `GOL SUD`
  - Opcionális: `match_sectors.sector_name` CHECK constraint a 4 fix értékre
  - A `match_sectors` tábla struktúrája változatlan (id, match_id, sector_name, total_seats, sold_seats, price)
- [x] 16.2 Auto-seed logika a meccs sync-ben (`POST /api/admin/matches/sync` kibővítése):
  - Minden új meccs upsert után: ellenőrzés hogy létezik-e a 4 fix szektor a meccshez
  - Ha nem, beillesztés default kapacitással és default árral (pl. TRIBUNA: 5000 hely 80€, LATERAL: 8000 hely 50€, GOL NORD: 3000 hely 30€, GOL SUD: 3000 hely 30€)
  - Idempotens: már létező meccsre nem írja felül a már módosított szektorokat
- [x] 16.3 Admin szektor endpoint módosítása:
  - `POST /api/admin/matches/[id]/sectors` — DEPRECATED (404 vagy 405 visszaadása új szektor létrehozási kísérletre)
  - `PUT /api/admin/matches/[id]/sectors/[sectorId]` — csak `total_seats` és `price` módosítható, a `sector_name` immutable
- [x] 16.4 Manuális seed admin endpoint (biztonsági háló):
  - `POST /api/admin/matches/[id]/seed-sectors` — ha egy meccsnek hiányzik szektora, manuálisan újra-seed a 4 fix szektort default értékekkel
- [x] 16.5 Default érték konstansok (`src/lib/constants/sectors.ts`):
  - A 4 szektor neve és default kapacitás/ár konstansként exportálva
  - Frontend és backend közösen használja

**Acceptance Criteria:**

- A meglévő szektorok és jegyek törölve vannak
- Új meccs szinkronizálásakor automatikusan létrejön a 4 fix szektor
- Az admin nem tud új szektort hozzáadni egy meccshez
- Az admin tudja módosítani a kapacitást és az árat
- A jegyvásárlás flow változatlanul működik a 4 fix szektorral
- Idempotens seed: ismételt sync nem írja felül a módosított árakat/kapacitásokat

**Dependencies:** Iteration 6, Iteration 13

---

### Iteration 17 — Szavazás: "Más / Egyik sem" Opció

**Status:** DONE

**Goal:** A szavazórendszer kibővítése: az admin a szavazás létrehozásakor opcionálisan hozzáadhat egy "Más / Egyik sem" speciális opciót. Ha ez a helyes válasz, az erre szavazók kapnak pontot.

**UI required:** No

**Tasks:**

- [x] 17.1 Adatbázis séma kiterjesztés (`supabase/migrations/<dátum>_polls_none_option.sql`):
  - A `polls.options` JSONB már támogatja a tetszőleges struktúrát; konvenció bevezetése: minden opció `{ id: string, text: string, isNone?: boolean }` formátumban
  - Opcionális: `polls.has_none_option BOOLEAN DEFAULT false` flag az egyszerű query-khez
- [x] 17.2 Admin szavazás létrehozó endpoint kiterjesztés (`POST /api/admin/polls`):
  - Új body field: `addNoneOption` (boolean), `noneOptionText` (string, default: "Más / Egyik sem")
  - Ha `addNoneOption = true`, az `options` tömb végére hozzáfűz egy `{ id: 'none', text: noneOptionText, isNone: true }` opciót
  - Validáció: a `noneOptionText` max 100 karakter
- [x] 17.3 Admin szavazás szerkesztő endpoint (`PUT /api/admin/polls/[id]`):
  - Lehetővé teszi a teljes options tömb frissítését (csak ha még nincs lezárva: `is_active = true` és `correct_option = null`)
  - A "none" opció hozzáadható/törölhető a szavazás resolve előtt
- [x] 17.4 `resolve_poll` RPC kiterjesztés:
  - A `correct_option` lehet egy normál opció ID vagy a "none" string
  - Ha `correct_option = 'none'`, az erre szavazók kapnak 50 pontot (ugyanaz a logika mint a normál helyes válasz)
  - Atomic tranzakció: pont jóváírás + `point_transactions` bejegyzés
- [x] 17.5 Frontend integráció előkészítése: a `GET /api/polls` és `GET /api/polls/[id]/results` response-ok jelezzék a "none" opció jelenlétét és helyes voltát

**Acceptance Criteria:**

- Admin tud "Más / Egyik sem" opciós szavazást létrehozni
- A szerkesztés lehetővé teszi az opció hozzáadását/eltávolítását resolve előtt
- Ha a "none" a helyes válasz, az erre szavazók kapnak 50 pontot
- A meglévő szavazások (none opció nélkül) változatlanul működnek
- A pontszétosztás atomikus

**Dependencies:** Iteration 9

---

### Iteration 18 — Közösségi: Direct Messaging & Követés Rendszer

**Status:** DONE

**Goal:** A közösségi modul kibővítése privát üzenetküldéssel (DM) Supabase Realtime alapokon, és egy egyszerű követési rendszerrel ami szabályozza ki kinek küldhet üzenetet. A scope döntés: a követési rendszer kis méretű (≤3 task), ezért a "csak követöttek küldhetnek" modellt választjuk (b opció).

**UI required:** No

**Tasks:**

- [x] 18.1 Adatbázis séma — DM (`supabase/migrations/<dátum>_direct_messaging.sql`):
  - `conversations` tábla: `id` (uuid PK), `participant_a` (uuid FK profiles), `participant_b` (uuid FK profiles), `created_at`, `last_message_at`. Unique constraint a (least(a,b), greatest(a,b)) párra hogy egy beszélgetés csak egyszer létezzen
  - `messages` tábla: `id` (uuid PK), `conversation_id` (uuid FK), `sender_id` (uuid FK profiles), `content` (text), `created_at`, `read_at` (timestamptz NULL)
  - Indexek: `messages(conversation_id, created_at DESC)`, `conversations(participant_a)`, `conversations(participant_b)`
- [x] 18.2 Adatbázis séma — Követés:
  - `follows` tábla: `id` (uuid PK), `follower_id` (uuid FK profiles), `following_id` (uuid FK profiles), `created_at`. Unique (follower_id, following_id), CHECK follower_id != following_id
  - Indexek: `follows(follower_id)`, `follows(following_id)`
- [x] 18.3 RLS policy-k:
  - `conversations`: user csak azt látja amiben résztvevő (participant_a vagy participant_b a saját user_id), insert csak ha a user az egyik résztvevő
  - `messages`: user csak azt látja amelyik egy olyan conversation-höz tartozik amiben résztvevő, insert csak ha a sender_id a user és résztvevője a conversation-nek
  - `follows`: bárki olvashat (publikus follower count), insert csak ha follower_id a user, delete csak ha follower_id a user
- [x] 18.4 Követés endpointok:
  - `POST /api/users/[id]/follow` — a bejelentkezett user követi a [id] usert
  - `DELETE /api/users/[id]/follow` — kikövetés
  - `GET /api/users/[id]/followers` — a [id] user követőinek listája (lapozható)
  - `GET /api/users/[id]/following` — kit követ a [id] user
  - `GET /api/users/[id]/follow-status` — a bejelentkezett user követi-e a [id] usert (boolean)
- [x] 18.5 DM endpointok — beszélgetések:
  - `GET /api/conversations` — a bejelentkezett user beszélgetéseinek listája (utolsó üzenet, partner profil, olvasatlan-szám), `last_message_at DESC` rendezve
  - `POST /api/conversations` — új beszélgetés indítása (recipient_id). Ellenőrzés: a recipient_id-t a user követi (a "csak követöttek" modell). Ha már létezik beszélgetés a két user között, az meglévőt adja vissza (idempotens)
- [x] 18.6 DM endpointok — üzenetek:
  - `GET /api/conversations/[id]/messages` — egy beszélgetés üzenetei (lapozott, `created_at DESC`, default limit 50). Auth check: a user résztvevő-e
  - `POST /api/conversations/[id]/messages` — üzenet küldése (content). Ellenőrzés: résztvevő, content nem üres, max 2000 karakter, és a user követi a recipient-et
  - `PUT /api/conversations/[id]/read` — összes üzenet olvasottra állítása amelyek nem a user-től származnak (`read_at = now()`)
- [x] 18.7 User kereső a DM-hez:
  - `GET /api/users/search?q=...` — a bejelentkezett user által követett userek között keres username/email alapján (csak követötteket találja a DM-init flow-hoz)
  - Limit 20 találat
- [x] 18.8 Supabase Realtime konfigurálás:
  - A `messages` és `conversations` táblák realtime publikációra állítása (`ALTER PUBLICATION supabase_realtime ADD TABLE messages, conversations`)
  - RLS érvényesül a realtime channel-eken is — a kliens csak azokat az üzeneteket kapja, amelyekre jogosult

**Acceptance Criteria:**

- User tud követni / kikövetni más usereket
- A követők és követettek listája lekérdezhető
- DM csak követett user részére indítható
- Üzenetek küldése és lekérdezése működik a beszélgetésen belül
- Olvasott állapot beállítható
- A Supabase Realtime channel valós idejű új üzenet eseményeket küld
- RLS megakadályozza hogy a user idegen beszélgetéseket lásson

**Dependencies:** Iteration 2 (auth, profiles), Iteration 8 (közösségi alaprendszer)

---

### Iteration 19 — Álomcsapat Perzisztencia

**Status:** DONE

**Goal:** A frontend álomcsapat (drag-and-drop) feature-höz backend perzisztencia: a user mentheti és visszatöltheti a saját álomcsapatát. Megosztás nem támogatott, csak a user saját maga számára.

**UI required:** No

**Tasks:**

- [x] 19.1 Adatbázis séma (`supabase/migrations/<dátum>_dream_teams.sql`):
  - `dream_teams` tábla: `id` (uuid PK), `user_id` (uuid FK profiles), `name` (text, default: "Álomcsapatom"), `formation` (text, pl. "4-2-3-1", "4-3-3"), `players` (JSONB — { positionSlot: { player_id, name, position } } map), `created_at` (timestamptz), `updated_at` (timestamptz)
  - Index: `dream_teams(user_id)`
  - Constraint: `formation` IN ('4-3-3', '4-2-3-1', '3-5-2', '4-4-2')
- [x] 19.2 RLS policy-k:
  - User csak a sajátját olvashatja, módosíthatja, törölheti
  - Insert csak ha user_id = auth.uid()
- [x] 19.3 CRUD endpointok (`src/app/api/dream-team/`):
  - `GET /api/dream-team` — a bejelentkezett user álomcsapata (vagy 404 ha nincs)
  - `POST /api/dream-team` — új álomcsapat létrehozása (formation, players, opcionális name)
  - `PUT /api/dream-team/[id]` — álomcsapat frissítése
  - `DELETE /api/dream-team/[id]` — álomcsapat törlése
- [x] 19.4 Validáció:
  - `players` JSONB struktúra validálása: a kulcsok valid pozíció slotok (a formation alapján), az értékek tartalmazzák a player_id-t (valid `players.id` érték)
  - Egy player_id csak egyszer fordulhat elő egy dream team-ben
  - Maximum egy álomcsapat per user (vagy `POST` upsert szemantika)

**Acceptance Criteria:**

- User tudja menteni az álomcsapatát formációval és játékos elrendezéssel
- Visszatöltéskor a teljes állapot helyreáll
- Csak a saját álomcsapatát látja és szerkesztheti
- A formation és players struktúrája validált
- A megosztás funkció szándékosan nincs (későbbi iteráció lehet)

**Dependencies:** Iteration 4 (players tábla), Iteration 2 (auth)

---

### Iteration 20 — Bug Fix: Hír 500 / Kupon RPC / Játékos Statisztika Szinkron / Szavazás Meccs Szűrő

**Status:** DONE

**Goal:** A manuális tesztelés során feltárt 4 backend hiba kijavítása: cikk részletes oldal 500-as hiba, kupon beváltás pgcrypto hiba, játékos statisztikák szinkronizálásának javítása, szavazás létrehozásnál meccs lista szűrő.

**UI required:** Részben (a meccs lista szűrőhöz frontend admin oldal hívást is módosítani kell)

**Tasks:**

- [x] 20.1 Hír 500-as hiba javítása: `src/app/api/articles/[id]/route.ts`-ban UUID validáció hozzáadása (ha az id nem valid UUID formátumú, 404-et adjon vissza a 500 helyett; `22P02` PostgreSQL hiba catch-elése és 404-re konvertálása)
- [x] 20.2 Kupon beváltás RPC javítása: A `redeem_coupon` PostgreSQL function-ben `gen_random_bytes(6)` cseréje `gen_random_uuid()` alapú kódgenerálásra (pl. `BARCA-` prefix + uuid első 8 karaktere nagybetűsen) — a `pgcrypto` extension nincs engedélyezve Supabase-ben; szükséges migrációs fájl létrehozása (`supabase/migrations/<dátum>_fix_redeem_coupon_rpc.sql`)
- [x] 20.3 Játékos statisztika szinkron javítása: `src/app/api/admin/players/sync/route.ts` és `src/lib/football-data.ts` ellenőrzése — a `getScorers()` hívás valóban mappel-i-e a player ID-kat a `players` táblában lévő `api_football_id` (football-data.org player ID) alapján; ha a matching hibás, javítás; a `stats` JSONB mezőbe írt kulcsok (`goals`, `assists`, `playedMatches`, `yellowCards`, `redCards`) konzisztensek legyenek a frontend parser (`readPlayerStats`) által várt kulcsokkal
- [x] 20.4 Szavazás meccs lista szűrő: Az admin szavazás létrehozó formhoz meccseket visszaadó endpoint szűrési feltételének javítása — a `SCHEDULED`, `TIMED` és `IN_PLAY` státuszú (tehát még nem lejátszott) meccsek jelenjenek meg; a `FINISHED`, `CANCELLED`, `POSTPONED` státuszú meccsek ne szerepeljenek a listában; ha az endpoint a `matches` táblát `status` alapján szűri, a feltétel legyen: `status NOT IN ('FINISHED', 'CANCELLED', 'POSTPONED', 'AWARDED')`

**Acceptance Criteria:**

- Hír részletes oldal érvénytelen ID esetén 404-et ad, nem 500-at
- Kupon beváltás sikeres, "gen_random_bytes" hiba megszűnik
- A játékos szinkronizáció után a `stats` mezők valós adatokat tartalmaznak (legalább Alex Baldé és más érintett játékosok esetén)
- Az admin szavazás létrehozó formban megjelennek a nem lejátszott meccsek

**Dependencies:** Iteration 13, 10, 4, 9

---

### Iteration 21 — Bug Fix: Követés 404, Profil Név Megjelenítés, User Posztolás & DM Követés

**Status:** DONE

**Goal:** A közösségi modul élesüzemi tesztelése során feltárt hibák backend oldali javítása: a `POST /api/users/[id]/follow` endpoint 404-es hibát dob (a target user nem található vagy UUID validáció hiányzik), a poszt feed response-ban az author profil adatok (username, avatar_url) inkonzisztensek vagy hiányoznak, a feed posztolás csak adminra van korlátozva (a userek számára is engedélyezni kell), és a DM oldalon nincs lehetőség egymást bekövetni a meglévő follow endpointokon keresztül.

**UI required:** No

**Tasks:**

- [x] 21.1 Követés endpoint 404 hiba javítása: `src/app/api/users/[id]/follow/route.ts`-ben (POST és DELETE) UUID validáció hozzáadása az `[id]` paraméterre (ha nem valid UUID formátum, 400 Bad Request, nem 404); a target user létezésének ellenőrzése a `profiles` táblában (ha nem található, értelmes 404 üzenettel `{ error: 'Felhasználó nem található' }`); a `22P02` PostgreSQL hiba catch-elése; ellenőrzés hogy a `follower_id != following_id` (saját magát ne tudja követni) — ha igen, 400; logging: a hibás kérések root cause-ának logolása szerveroldalon
- [x] 21.2 Posztok endpoint author profil JOIN: `GET /api/posts` és a polling endpoint response-ainak ellenőrzése — minden poszthoz konzisztensen visszaadódik az author profil adatai (`profiles` JOIN-nal: `username`, `avatar_url`, `id`); a Supabase query a `posts` és `profiles` táblát explicit JOIN-olja (`select('*, author:profiles!author_id(id, username, avatar_url)')`); a response shape-ben az author objektum minden mezővel jelen van, üres user esetén default fallback ("Ismeretlen szurkoló"); azonos JOIN logika alkalmazása a `GET /api/posts/[id]` és `GET /api/posts/[id]/comments` endpointokon is, hogy a komment szerzők is legyenek profillel
- [x] 21.3 User feed posztolás endpoint: új `POST /api/posts` endpoint létrehozása (`src/app/api/posts/route.ts`) bejelentkezett userek számára — body: `{ content: string, image?: File }`, validáció: content nem üres, max 2000 karakter; a `posts` táblába `author_id = auth.uid()` mezővel insert; opcionális kép feltöltés a `post-images` bucketbe (admin endpointtal megegyező logika); RLS policy frissítése a `posts` táblán: insert engedélyezve minden bejelentkezett usernek (eddig csak admin); az admin poszt endpoint (`POST /api/admin/posts`) változatlan marad (kompatibilitás); user csak a saját posztját szerkesztheti/törölheti (új `PUT /api/posts/[id]` és `DELETE /api/posts/[id]` user endpoint, RLS-szel védve); admin bármely posztot törölhet
- [x] 21.4 DM oldal — follow integráció backend ellenőrzés: `GET /api/conversations` response kibővítése a partner profil mezőivel + `is_following` boolean (a bejelentkezett user követi-e a partnert, follow-status JOIN); a meglévő `POST /api/users/[id]/follow` és `DELETE /api/users/[id]/follow` endpointok elérhetők és validálnak helyesen DM kontextusban is; RLS policy ellenőrzése a `follows` táblán (insert/delete csak a `follower_id = auth.uid()`-re); regressziós teszt: DM listából követés/kikövetés flow végigfutása

**Acceptance Criteria:**

- A `POST /api/users/[id]/follow` endpoint érvénytelen UUID-re 400-at, nem létező userre 404-et ad világos hibaüzenettel — nem dob 500-at vagy néma 404-et
- A `GET /api/posts` és `GET /api/posts/[id]/comments` response-ok minden item-en konzisztens author objektumot tartalmaznak (`id`, `username`, `avatar_url`)
- Bejelentkezett user (nem admin) sikeresen tud posztot létrehozni a `POST /api/posts` endpointon át, opcionális képpel
- User csak a saját posztját szerkesztheti/törölheti, admin bármelyiket
- Az admin poszt endpoint továbbra is működik (regression-mentes)
- A `GET /api/conversations` response tartalmazza a partner profil adatait és `is_following` mezőjét
- A DM listából a follow/unfollow endpointok hívhatók és atomic módon frissítik a `follows` táblát

**Dependencies:** Iteration 8 (közösségi feed), Iteration 18 (DM & follow rendszer)

---

### Iteration 22 — Közösségi Bug Fix: Követés Jóváhagyás, Profil 404, Komment Nevek, Keresés, Suggested Widget

**Status:** DONE

**Goal:** A közösségi modul tesztelése során feltárt hibák backend javítása + követési rendszer jóváhagyás-alapúvá alakítása.

**UI required:** Részben (frontend F26 párhuzamosan)

**Tasks:**

- [x] 22.1 `follows` tábla migration — `status TEXT NOT NULL DEFAULT 'pending'` oszlop hozzáadása (`'pending'` | `'accepted'`); meglévő sorok migrálása `'accepted'`-re (visszafelé kompatibilis)
- [x] 22.2 Follow endpoint átdolgozása — `POST /api/users/[id]/follow` mostantól `status = 'pending'` kérelmet hoz létre (nem azonnali követés); `DELETE /api/users/[id]/follow` visszavonja a kérelmet vagy kikövet; `GET /api/users/[id]/follow-status` visszaadja: `'not_following'` | `'pending'` | `'following'`
- [x] 22.3 Follow-request kezelő endpointok — `GET /api/follow-requests` (beérkező kérelmek listája, pending státuszú), `PUT /api/follow-requests/[id]/accept`, `PUT /api/follow-requests/[id]/reject`
- [x] 22.4 DM jogosultság frissítése — `POST /api/conversations` és `POST /api/conversations/[id]/messages` csak `status = 'accepted'` státuszú follow esetén engedélyezett (mindkét irányú OR egyirányú — a jelenlegi logika szerint: a küldőnek kell követnie az elfogadottat)
- [x] 22.5 Üzenetek keresés javítása — `GET /api/users/search` mostantól az ÖSSZES aktív usert keresi (username/email alapján), nem csak a követötteket — hogy az Üzenetek felületen bárki megtalálható és bekövethető legyen; limit 20
- [x] 22.6 Komment author JOIN javítás — `GET /api/posts` és `GET /api/posts/[id]/comments` válaszában minden kommenthez `author: { id, username, avatar_url }` JOIN a `profiles` táblából
- [x] 22.7 Publikus profil endpoint — `GET /api/users/[id]/profile` — publikus profil adatok (id, username, avatar_url, created_at, posts count); bárki elérheti, nem kell auth; UUID validáció + 404 ha nem létezik
- [x] 22.8 Javasolt Szurkolók endpoint — `GET /api/users/suggested` — a bejelentkezett user által még nem követett (és nem pending) userek listája, max 10; rendezés: legutóbb regisztrált vagy véletlenszerű

**Acceptance Criteria:**

- A `follows` táblán a `status` oszlop bevezetésre kerül, létező sorok `'accepted'`-re migrálódnak
- `POST /api/users/[id]/follow` `pending` státuszú kérelmet hoz létre, `GET /api/users/[id]/follow-status` a három állapotot helyesen tükrözi
- A follow-request endpointokon az elfogadás `accepted`-re vált, az elutasítás törli a sort
- DM küldés és beszélgetés indítás csak `accepted` status esetén engedélyezett, egyébként 403
- `GET /api/users/search` az összes aktív userre keres (nem csak a követöttekre), limit 20
- `GET /api/posts` és komment endpoint válaszaiban minden poszt és komment item-en konzisztens `author: { id, username, avatar_url }` objektum jelenik meg
- `GET /api/users/[id]/profile` érvényes UUID-re visszaadja a publikus adatokat, érvénytelen UUID-re 400, nem létező userre 404
- `GET /api/users/suggested` csak olyan usereket ad vissza, akiket a bejelentkezett user még nem követ és nincs pending kérelem, max 10 elem

**Dependencies:** Iteration 18 (follows, DM rendszer)

---
### Iteration 23 — Bug Fix: Supabase Warningok, Kupon Statisztika & Hard Delete, Játékos Kép Eltávolítás

**Status:** DONE

**Goal:** Az éles használat során feltárt backend hibák és hiányzó funkciók pótlása: Supabase oldali hibák / warningok javítása (errors.md 8. pont), admin kupon oldal kibővítése statisztika endpointtal és hard delete endpointtal a meglévő soft delete mellé (errors.md 7. pont backend része), valamint az admin játékos szerkesztő endpoint kiegészítése expliccit kép-eltávolítás támogatással (errors.md 6. pont backend része).

**UI required:** No

**Tasks:**

- [x] 23.1 Supabase hibák és warningok javítása (errors.md 8. pont):
  - A Supabase dashboardon megjelenő security advisor / performance advisor warningok átnézése
  - A jelzett RLS policy hiányosságok javítása (ha van olyan tábla amelyiken hiányzik a policy vagy túl megengedő)
  - A jelzett indexelési problémák kezelése (hiányzó index foreign key-en, fölösleges duplicate index)
  - Az auth.users táblát hivatkozó function-ök / view-k `search_path` beállítása explicit `public`-ra ahol Supabase ezt javasolja (mutable search_path warning)
  - Definer/invoker security a public function-ökön áttekintve, ahol szükséges javítva
  - Migrációs fájl: `supabase/migrations/<dátum>_supabase_warnings_fix.sql`

- [x] 23.2 Kupon statisztika endpoint (errors.md 7. pont — admin oldal kibővítés):
  - Új `GET /api/admin/coupons/[id]/stats` endpoint létrehozása
  - Visszaadja a kuponra vonatkozó aggregált statisztikákat: `redemption_count` (hányan váltották be — `redeemed_coupons` táblából `coupon_id` szerint), `usage_count` (hányan használták fel ténylegesen — `redeemed_coupons` táblából `coupon_id` + `is_used = true` szerint), `unused_count` (`redemption_count - usage_count`)
  - Opcionális: az aggregált adatok bekerülhetnek a meglévő `GET /api/admin/coupons` listázó válaszába is (`coupon_redeem_stats` view bővítés vagy új JOIN)
  - Csak admin érheti el (requireAdmin)

- [x] 23.3 Kupon hard delete endpoint (errors.md 7. pont — törlő gomb backend):
  - Új `DELETE /api/admin/coupons/[id]/hard` endpoint létrehozása (külön a meglévő soft delete `DELETE /api/admin/coupons/[id]` mellett)
  - A meglévő `DELETE /api/admin/coupons/[id]` endpoint továbbra is soft delete-et végez (is_active=false) — visszafelé kompatibilis
  - Az új hard delete endpoint TÉNYLEGESEN törli a kupont a `coupons` táblából
  - Cascade kezelés: a `redeemed_coupons` tábla `coupon_id` foreign key-e SET NULL vagy CASCADE viselkedés egyértelművé tétele migrációval (jelenleg lehet hogy hibát dobna)
  - Figyelmeztetés a response body-ban: hány felhasználói beváltott kupon érintett (törlés előtt számolás), hogy a frontend megjeleníthesse a megerősítő dialógust
  - Csak admin érheti el (requireAdmin)
  - Migrációs fájl: `supabase/migrations/<dátum>_coupons_hard_delete_cascade.sql` (ha kell FK módosítás)

- [x] 23.4 Admin játékos kép eltávolítás backend (errors.md 6. pont — kép törlés gomb backend):
  - A meglévő `PUT /api/admin/players/[id]` endpoint kibővítése: új form mező `removeImage` (boolean, "true"/"false")
  - Ha `removeImage = "true"`: a `players.image_url` mezőt `NULL`-ra állítja, és a Storage-ban lévő képet törli (`safeDeleteImage`)
  - Validáció: a `removeImage = "true"` és új `image` File egyidejű küldése esetén az új kép nyeri a verzenyt (image upload prioritás), vagy 400 hiba — egyértelmű döntés implementáláskor
  - A meglévő funkcionalitás (bio + új kép feltöltés) változatlan marad
  - Logging: kép-eltávolítási események logolása

- [x] 23.5 Regressziós tesztelés:
  - A 4 új/módosított endpoint manuális tesztelése a development környezetben
  - Edge case-ek: hard delete olyan kuponra ami már beváltott, kép-eltávolítás olyan játékosra akinek nincs képe, statisztika lekérdezés nem létező kupon ID-ra
  - A meglévő soft delete és image upload regressziómentes

**Acceptance Criteria:**

- A Supabase advisor warningok száma csökken vagy nullára esik
- A `GET /api/admin/coupons/[id]/stats` helyesen visszaadja a beváltási és felhasználási darabszámokat
- A `DELETE /api/admin/coupons/[id]/hard` ténylegesen törli a kupont a `coupons` táblából, miközben a `redeemed_coupons` táblát konzisztensen kezeli (cascade vagy SET NULL)
- A meglévő `DELETE /api/admin/coupons/[id]` továbbra is soft delete-et végez (regressziómentes)
- A `PUT /api/admin/players/[id]` endpoint a `removeImage=true` form mezővel sikeresen NULL-ra állítja az `image_url`-t és törli a Storage-ban lévő fájlt
- A meglévő image upload és bio módosítás flow változatlanul működik
- Csak admin érheti el az új endpointokat

**Dependencies:** Iteration 4 (players), Iteration 10 (coupons), Iteration 12 (RLS)

---
