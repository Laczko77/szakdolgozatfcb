# FC Barcelona Szurkolói Portál — Projekt Specifikáció

## Projekt Áttekintés

Fullstack webalkalmazás, egy FC Barcelona szurkolói portál, amely egyesíti a hírportál, webshop, jegyértékesítés, játékos-adatbázis, közösségi felület, szavazórendszer és analitika funkciókat egyetlen platformon. Szakdolgozat projekt, programtervező informatikus szak.

---

## Tech Stack

- **Frontend & Backend:** Next.js (App Router, TypeScript, Tailwind CSS)
- **Adatbázis & Auth:** Supabase (PostgreSQL, Supabase Auth, RLS, Storage)
- **Külső API:** API-Football (api-sports.io) — játékos statisztikák és meccs adatok (FC Barcelona `team_id = 529`)
- **Fizetés:** Szimulált / demo (nincs valós Stripe integráció)
- **Nyelv:** Magyar nyelvű felület
- **Fejlesztés:** Claude Code agent
- **Deployment:** Vercel (a deploy-t a fejlesztő végzi manuálisan)
- **Fontok:** Bebas Neue (display/heading, Google Fonts) + DM Sans (body, Google Fonts)
- **Rich Text Editor:** Tiptap (cikkek szerkesztéséhez az admin panelben)
- **Form kezelés:** react-hook-form + zod validáció
- **UI komponensek (admin):** shadcn/ui (Table, Form, Dialog, Select, Badge stb.)
- **Charting:** Recharts (admin analitika dashboard)

---

## Autentikáció & Jogosultságkezelés

- Supabase Auth: email/jelszó + Google OAuth login
- Két role: `user` (alapértelmezett regisztrációkor) és `admin`
- Az `/admin/*` route-ok Next.js middleware-rel védettek, csak admin role éri el
- Regisztrációkor automatikusan létrejön egy `profiles` sor (Database Trigger)
- Értesítés kizárólag a Supabase regisztrációs email, más email értesítés nincs

---

## Képkezelés

Minden kép Supabase Storage-ban tárolódik, 5 külön bucket:
- `profile-images` — felhasználói profilképek
- `article-images` — hír/cikk képek
- `player-images` — játékos képek
- `product-images` — webshop termék képek
- `post-images` — közösségi posztok képei

---

## Fejlesztési Fázisterv

### 🔴 1. FÁZIS — MVP MAG (kötelező)
Autentikáció, hírrendszer, játékos adatbázis, webshop, jegyrendszer, profiloldal, globális kereső, admin panel váz.

### 🟡 2. FÁZIS — SOCIAL
Közösségi feed, kommentek, reakciók, polling.

### 🟢 3. FÁZIS — GAMIFICATION
Szavazórendszer, pontrendszer, pont-áruház, kuponbeváltás.

### 🔵 4. FÁZIS — ANALITIKA
Cookie tracking, GDPR consent, admin analitika dashboard, adatvezérelt ajánlások.

---

## Feature-ök Részletes Leírása

### 1. Hírrendszer (CMS)

- Az admin hozza létre, szerkeszti és törli a cikkeket képekkel
- Rich text szerkesztő: Tiptap editor (formázott szöveg: headings, bold, italic, listák, linkek)
- A cikkek tartalma HTML formátumban tárolódik az adatbázisban
- Fix kategóriák: transfers, match-report, interview, news
- Userek olvasnak és kereshetnek a cikkek között
- A cikkek a globális keresőben is megjelennek

### 2. Globális Kereső

- Egyetlen kereső mező a navigációs sávban
- Keres egyszerre: cikkek, termékek, játékosok, közösségi posztok között
- Csak bejelentkezett felhasználók használhatják
- Eredmények típus szerint csoportosítva jelennek meg

### 3. Játékos Adatbázis

- Adatforrás: API-Football (FC Barcelona aktuális keret, csak aktuális szezon)
- Az admin egy "Frissítés" gombbal szinkronizálja az adatokat az API-ból a Supabase-be
- Statisztikák: gólok, gólpasszok, meccsek, sárga/piros lapok stb. (JSONB mezőben)
- Az admin kézzel is szerkeszthet adatokat (bio, egyedi leírás) — ezeket a szinkronizáció nem írja felül
- Játékos képek az API-ból jönnek
- Publikusan böngészhetők, szűrhetők pozíció szerint

### 4. Webshop

**Termékek:**
- Admin kezeli: létrehozás, szerkesztés, törlés, képfeltöltés
- Fix kategóriák: `mezek` (későbbiekben bővíthető új kategóriákkal)
- Variánsok: méret és szín kombinációk, mindegyikhez külön készletszám
- Készletkezelés: a felületen látszik hány darab van raktáron

**Kosár:**
- Tétel hozzáadása, mennyiség módosítása, törlés
- Készletellenőrzés: nem lehet többet kosárba tenni mint ami raktáron van

**Checkout (demo):**
- Szimulált fizetés, nincs valós pénzmozgás
- Nincs szállítási költség (a szállítás is szimulált)
- Rendelés létrehozásakor készlet csökken, kosár ürül
- Opcionálisan kuponkód alkalmazható (pont-áruházból)

**Rendelés lemondás:**
- User lemondhatja a rendelést, DE csak addig amíg az admin nem állította "shipped" (feladva) státuszra
- Feladás után nem mondható le

**Szállításkezelés:**
- Kizárólag az admin kezeli
- Státuszok: feldolgozás → feladva → kézbesítve
- Az admin kézzel lépteti a státuszokat

**Wishlist (kívánságlista):**
- User hozzáadhat/eltávolíthat termékeket
- Egy terméket csak egyszer lehet felvenni

**Értékelések:**
- 5 csillagos skála + szöveges vélemény
- Egy user egy terméket csak egyszer értékelhet
- Az admin moderálja: elrejtheti/megjelenítheti az értékeléseket

### 5. Jegyrendszer

**Meccsek:**
- Az API-Football-ból szinkronizálódnak az FC Barcelona meccsei a Supabase-be
- Az admin egy gombbal triggereli a szinkronizációt

**Szektorok:**
- Az admin meccsenként hirdeti meg a szektorokat (pl. "Gol Sud" — 400 jegy, 15000 Ft/jegy)
- Minden szektorhoz megadja az elérhető jegyek számát és a jegy árát
- Ha egy szektor betelt (sold_seats = total_seats), automatikusan lezáródik
- Az admin utólag is tud extra jegyeket hozzáadni (total_seats növelése)

**Jegyvásárlás:**
- A user kiválasztja a szektort, a rendszer automatikusan osztja ki a székszámot (következő szabad)
- Maximum 4 jegy/felhasználó/meccs
- Demo fizetés (nincs valós tranzakció)

### 6. Közösségi Feed

**Posztok:**
- Kizárólag az admin posztol (szöveggel és opcionális képpel)
- Admin szerkesztheti és törölheti a posztjait

**Kommentek:**
- Bejelentkezett userek kommentelhetnek a posztokhoz
- Userek törölhetik a saját kommentjüket
- Az admin bármely kommentet moderálhatja (törölheti)
- Report funkció egyelőre nincs

**Reakciók:**
- Többféle emoji reakció (Facebook-szerű)
- Reagálni lehet posztokra ÉS kommentekre is
- Egy user egy elemre csak egyféle reakciót adhat; ha másikat ad, az előző cserélődik

**Rendezés:**
- Kommentek népszerűségi sorrendben (legtöbb reakció elöl), mint Facebookon

**Frissítés:**
- Nem real-time, hanem 3 másodperces polling (a kliens időközönként lekéri az új adatokat)
- A polling endpoint támogat `since` paramétert a hatékonyság érdekében

### 7. Szavazórendszer

**Szavazás létrehozása:**
- Az admin hozza létre a szavazásokat (kérdés + opciók)
- Példa: "Szerintetek ki lesz a meccs legjobbja?" → Lewandowski, Pedri, Gavi, Yamal

**Szavazás menete:**
- Bejelentkezett userek szavaznak, egy user csak egyszer szavazhat
- A szavazás a meccs végéig aktív

**Lezárás:**
- A meccs után az admin beállítja a helyes választ
- A rendszer automatikusan kiosztja a pontokat a helyes szavazóknak

**Pontozás:**
- Fix 50 pont / helyes szavazat
- A pontok a user `user_points` egyenlegéhez adódnak
- Minden tranzakció naplózódik a `point_transactions` táblában

### 8. Pont-Áruház

**Kuponok:**
- Az admin hozza létre a kuponokat különböző pontértékekhez
- Típusok: százalékos kedvezmény, fix összegű kedvezmény, ingyenes szállítás
- Példák: "15% kedvezmény bármely mezre — 200 pont", "Ingyenes szállítás — 100 pont", "VIP jegy kedvezmény — 500 pont"

**Beváltás:**
- A user a pont-áruházban böngészi az elérhető kuponokat
- Beváltáskor a pontegyenleg csökken, és egyedi kuponkód generálódik (`BARCA-XXXX-XXXX` formátum, alfanumerikus)
- A beváltott kuponok a profilban láthatók

**Felhasználás:**
- A kuponkód beírható a webshop VAGY jegy checkout-ban
- Egy kuponkód csak egyszer használható
- Felhasználás után `is_used = true`-ra vált

### 9. Profiloldal

- **Becenév (username):** szabadon módosítható
- **Profilkép:** feltöltés a `profile-images` Storage bucketbe
- **Jelszóváltoztatás:** Supabase Auth `updateUser`-en keresztül
- **Vásárlási előzmények:** webshop rendelések + megvásárolt jegyek együtt, időrendben
- **Pontegyenleg:** aktuális pontok és tranzakció-történet
- **Beváltott kuponok:** felhasznált és még aktív kuponok listája

### 10. Cookie Tracking & Analitika

**GDPR Consent:**
- Cookie consent banner az oldalra érkezéskor ("Elfogadom" / "Elutasítom")
- Csak elfogadás esetén történik tracking
- A beleegyezés rögzítődik a `cookie_consents` táblában

**Tracking:**
- Cookie-alapú: egy UUID generálódik a böngészőben
- Rögzíti: melyik oldalt nézte, melyik terméket nézte, mikor
- Adatok a `page_views` táblában

**Admin Dashboard:**
- Legnézettebb oldalak (top 20)
- Legnézettebb termékek (top 20)
- Összesített statisztikák (összes user, rendelés, bevétel)
- Az admin ezek alapján tud akciókat hirdetni, termékeket kiemelni

**Adatvezérelt ajánlások:**
- A legnézettebb/legjobban értékelt termékek kiemelt helyen jelennek meg

### 11. Admin Panel

- Az app-on belül él, `/admin` route alatt
- Middleware védi: csak `admin` role-ú userek érhetik el
- Innen kezel mindent az admin:
  - Cikkek létrehozása/szerkesztése/törlése
  - Termékek és készlet kezelése
  - Rendelések és szállítási státuszok
  - Meccsek szinkronizálása és szektorok kezelése
  - Játékosok szinkronizálása és kézi szerkesztése
  - Posztok írása és kommentek moderálása
  - Szavazások létrehozása és lezárása
  - Kuponok kezelése a pont-áruházban
  - Analitika dashboard megtekintése
  - Értékelések moderálása

---

## Fontos Technikai Döntések Összefoglalása

| Döntés | Választás | Indoklás |
|--------|-----------|----------|
| Fizetés | Demo/szimulált | Szakdolgozathoz elegendő |
| Szállítási költség | Nincs (szimulált) | A vásárlás demo, nincs valós szállítás |
| Játékos adat forrás | API-Football + kézi kiegészítés (team_id: 529) | Részletes statisztikák, ingyenes szint (100 req/nap) |
| Közösségi feed frissítés | 3 mp polling | Egyszerűbb mint real-time, Supabase Realtime nem szükséges |
| Admin panel elhelyezés | Ugyanaz az app (/admin route) | Egyszerűbb deployment és kódbázis |
| Auth | Supabase Auth + Google OAuth | Ki a dobozból működik, RLS-sel jól integrálódik |
| Képtárolás | Supabase Storage (5 bucket) | Natív Supabase integráció, nincs külső szolgáltatás |
| Nyelv | Magyar | A szakdolgozat és a célközönség magyar |
| Pontérték | Fix 50 pont/helyes szavazat | Egyszerű, kiszámítható rendszer |
| Jegylimit | Max 4/user/meccs | Reális korlát |
| Rendelés lemondás | Csak "shipped" státusz előtt | Logikus üzleti szabály |
| Fontok | Bebas Neue (display) + DM Sans (body) | Sportos heading + modern olvasható body, Google Fonts |
| Rich text editor | Tiptap | Modern, headless, React-kompatibilis, HTML output |
| Form kezelés | react-hook-form + zod | TypeScript-natív validáció, Next.js standard |
| Admin UI | shadcn/ui | Konzisztens, funkcionális admin komponensek |
| Kuponkód formátum | BARCA-XXXX-XXXX (alfanumerikus) | Rövid, márkázott, könnyen másolható |
| Termékkategóriák | mezek (bővíthető) | MVP-hez elegendő |
| Barça címer | Saját SVG (helyőrző, később cserélhető képre) | Szerzői jogi egyszerűség |
| Landing page média | Fejlesztő által előre elkészített videó/kép | Nem generált, hanem manuálisan készített tartalom |
| Deployment | Vercel | Natív Next.js támogatás, egyszerű CI/CD |
| Charting | Recharts | Admin analitika dashboard grafikonokhoz |
