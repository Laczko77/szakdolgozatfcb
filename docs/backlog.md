# FC Barcelona Szurkolói Portál — Backend Backlog

## Scope Summary

Egy FC Barcelona szurkolói portál backend rendszere Next.js + Supabase + API-Football stack-en. A projekt lefedi az autentikációt (email + Google), hírrendszert (CMS), játékos adatbázist külső API integrációval, webshopot készletkezeléssel és demo fizetéssel, jegyrendszert szektoralapú székiosztással, közösségi feedet reakciókkal, szavazórendszert pontgyűjtéssel, pont-áruházat kuponbeváltással, cookie-alapú analitikát, valamint a teljes admin panelt. Az adatok Supabase PostgreSQL-ben élnek, a képek Supabase Storage-ban 5 külön bucketben, a jogosultságkezelés RLS policy-kkel valósul meg.

---

## Backlog Progress

| Metric              | Value |
|---------------------|-------|
| Total tasks         | 68    |
| Completed tasks     | 49    |
| Remaining tasks     | 19    |
| Completion          | 72%   |

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

**Status:** TODO

**Goal:** Cookie-alapú user tracking megvalósítása GDPR consent kezeléssel, oldal- és terméknézettség rögzítése, és admin analitika endpoint-ok az adatvezérelt döntésekhez.

**UI required:** No (a consent banner a frontend iterációban készül, itt a backend logika)

**Tasks:**

- [ ] 11.1 Cookie consent endpoint-ok:
  - `POST /api/consent` — GDPR beleegyezés rögzítése (cookie_id generálás, consented: true/false)
  - A cookie_id egy UUID amit a böngészőben tárolunk, és minden tracking requesthez csatolunk
- [ ] 11.2 Page view tracking endpoint:
  - `POST /api/tracking/pageview` — oldalnézettség rögzítése (page_path, opcionális product_id, cookie_id). Csak akkor rögzít, ha a cookie_id-hoz tartozó consent = true
- [ ] 11.3 Admin analitika endpoint-ok (`src/app/api/admin/analytics/`):
  - `GET /api/admin/analytics/pages` — legnézettebb oldalak (top 20, időszak szűréssel)
  - `GET /api/admin/analytics/products` — legnézettebb termékek (top 20)
  - `GET /api/admin/analytics/overview` — összesített statisztikák (összes user, összes rendelés, összes bevétel, aktív szavazások)
- [ ] 11.4 Termékajánlás endpoint:
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

**Status:** TODO

**Goal:** Az összes Supabase tábla RLS policy-jének véglegesítése, az edge case-ek kezelése, és a teljes backend end-to-end tesztelése az összes modul együttműködésével.

**UI required:** No

**Tasks:**

- [ ] 12.1 Minden tábla RLS policy-jének felülvizsgálata és véglegesítése:
  - `cart_items`, `orders`, `order_items`: user csak a sajátját látja/módosítja
  - `tickets`: user csak a sajátját látja
  - `comments`, `reactions`: user a sajátját törölheti, bárki olvashat
  - `votes`: user a sajátját olvashatja, létrehozhat, de nem módosíthat
  - `user_points`, `point_transactions`, `redeemed_coupons`: user csak a sajátját látja
  - `page_views`, `cookie_consents`: insert bárki, read csak admin
- [ ] 12.2 Edge case-ek kezelése:
  - Race condition a jegyvásárlásnál (két user egyszerre veszi az utolsó jegyet) — Supabase RPC-vel tranzakcionális kezelés
  - Race condition a készletcsökkentésnél checkout-nál
  - Dupla kattintás védelem a szavazásnál és rendelésnél
- [ ] 12.3 API rate limiting megfontolások: a polling endpoint-oknál gondoskodni a hatékonyságról
- [ ] 12.4 End-to-end manuális teszt: a teljes user journey végigpróbálása (regisztráció → böngészés → vásárlás → szavazás → pont beváltás → kupon használat)

**Acceptance Criteria:**

- Egyetlen tábla sem érhető el RLS nélkül
- Race condition-ök kezelve vannak tranzakciókkal
- A teljes user journey hiba nélkül végigfut
- Admin journey is végigfut (cikk → termék → szektor → poszt → szavazás → lezárás → analitika)

**Dependencies:** Iteration 3–11 (mind)

---
