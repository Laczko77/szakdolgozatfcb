# BarcaPulse – Fejlesztési Ötletek

> Lehetséges új funkciók és bővítések a meglévő alkalmazáshoz. Minden ötlet mellett jelezve a megvalósíthatóság szintje és a szükséges technológiák.

---

## Felhasználói oldal (10 ötlet)

---

### 1. Webshop: Termékértékelések és vélemények

**Leírás:**  
A vásárlók 1–5 csillagos értékelést és szöveges véleményt hagyhatnak a termékeken. A terméklistán és a részletoldalon megjelenik az átlagos értékelés és az értékelések száma. Szűrés lehetséges értékelés szerint.

**Miért hasznos:**  
Növeli a bizalmat, segít a vásárlási döntésben, és élénkíti a közösségi élményt.

**Megvalósítás:**
- Új `product_reviews` tábla: `product_id`, `user_id`, `rating` (1–5), `comment`, `created_at`
- RLS: saját vélemény olvasható/írható, mindenki olvashatja a véleményeket
- Server Action: vélemény beküldése (egy felhasználó termékenként egyszer értékelhet)
- UI: csillag-selector komponens, vélemény lista a termék részletoldalán
- Admin oldalon: vélemények moderálása (törlés lehetősége)

**Megvalósíthatóság:** ✅ Közepes – 2–3 iteráció, tisztán Supabase + React alapon megoldható

---

### 2. Webshop: Népszerűségi sorrend és „Trending" kiemelés

**Leírás:**  
A termékek nézettségét számontartja a rendszer (oldallátogatás counter), és a legtöbbet megtekintett termékek automatikusan előre kerülnek a listában. A top 3 terméket „🔥 Trending" badge jelöli.

**Miért hasznos:**  
A social proof növeli a konverziót; a felhasználó megbízik abban, amit sokan néznek.

**Megvalósítás:**
- `products` táblához `view_count integer DEFAULT 0` mező
- Szerver action: termék részletoldalának betöltésekor `UPDATE products SET view_count = view_count + 1`
- Listázásnál opcionális "Népszerű" rendezési szempont (URL param: `?sort=popular`)
- Trending badge: a top 3 `view_count`-ú termék kap jelölést
- Teljesítmény: rate-limit a counter növelésre (session alapú, hogy ne inflálódjon)

**Megvalósíthatóság:** ✅ Könnyű – 1 iteráció, minimális sémaváltozás

---

### 3. Webshop: Akciók, kedvezmények és visszaszámláló

**Leírás:**  
Az adminisztrátor akciós árat és akcióidőszakot tud meghatározni egy termékhez. A terméklistán az akciós ár pirossal kiemelve jelenik meg, az eredeti árat áthúzva. Ha az akció határidős, visszaszámláló óra jelenik meg a termék oldalán.

**Miért hasznos:**  
Sürgősséget kelt, növeli az eladásokat; klasszikus e-kereskedelmi eszköz.

**Megvalósítás:**
- `products` táblához: `sale_price numeric`, `sale_ends_at timestamptz`
- UI: ha `sale_price` létezik és `sale_ends_at > now()`, az akciós ár aktív
- Visszaszámláló: kliens oldali `useEffect` + `setInterval` (nap/óra/perc/mp)
- Automatikus lejárat: a Supabase RLS/query `sale_ends_at > now()` feltétellel szűr
- Admin form: akciós ár és dátum mező hozzáadása a termékszerkesztőhöz

**Megvalósíthatóság:** ✅ Közepes – 1–2 iteráció

---

### 4. Webshop: AR Mez Felpróbáló (kamerás)

**Leírás:**  
A termék részletoldalán egy „Próbáld fel!" gombra kattintva a felhasználó kamerája bekapcsol, és a mez rávetítődik a testére valós időben. A felhasználó mozoghat, és megnézheti, hogyan állna rajta a mez.

**Miért hasznos:**  
Csökkenti a visszaküldési arányt, egyedi élményt nyújt, megkülönbözteti a webshopot a versenytársaktól.

**Megvalósítás:**
- **Technológia:** [MediaPipe Pose](https://google.github.io/mediapipe/solutions/pose) (Google, ingyenes, böngészőben fut) + Canvas API
- A MediaPipe valós időben detektálja a test kulcspontjait (váll, csípő koordináták)
- A mez képe (PNG, átlátszó háttér) a koordináták alapján skálázva és pozicionálva rá van renderelve a Canvas-ra a kamera képe fölé
- A kamera stream: `getUserMedia()` API
- Opcionális: képernyőkép mentés / megosztás gomb
- Korlát: csak akkor működik, ha a termékhez van külön „overlay PNG" (a mez kivágott képe)
- Admin oldalon: overlay kép feltöltési lehetőség a termékhez

**Megvalósíthatóság:** ⚠️ Összetett – 3–4 iteráció; a MediaPipe WASM-alapú, böngészőben fut, nincs szükség backendes AI-ra. A legnehezebb rész a pontos mez-igazítás és a különböző testméretek kezelése.

---

### 5. Meccsek: Élő statisztikák folyamatban lévő meccshez

**Leírás:**  
Ha épp zajlik Barcelona mérkőzése, a meccsek oldalon megjelenik egy „LIVE" szekció valós idejű adatokkal: labdabirtoklás %, lövések kapura, szögletek, sárga/piros lapok, gólok. Az adatok 30 másodpercenként frissülnek.

**Miért hasznos:**  
A rajongók a webalkalmazásból is követhetik az élő meccseket anélkül, hogy más forrást kellene nyitniuk.

**Megvalósítás:**
- API-Football `/fixtures?live=all` endpoint – csak élő meccseket ad vissza
- Next.js Route Handler: `/api/live-match` – szerver oldali polling az API-Football felé (30 mp-enként), eredményt cachelve
- Kliens oldali frissítés: `useEffect` + `setInterval(fetch, 30000)` vagy Supabase Realtime ha az adatot DB-be mentjük
- Alternatíva: Server-Sent Events (SSE) a Next.js Route Handler-ből
- Ha nincs élő meccs, a szekció nem jelenik meg

**Megvalósíthatóság:** ✅ Közepes – 2 iteráció; az API-Football ingyenes tier napi limitje korlátozhatja az élő frissítéseket, rate limit figyelemmel kell kísérni

---

### 6. Meccsek: Részletes meccs statisztikák és H2H

**Leírás:**  
Minden lejátszott meccs mellé kattintható részletes statisztika oldal: labdabirtoklás, lövések (kapura/mellé), szögletek, bedobások, les, szabadrúgás. Emellett Head-to-Head (H2H) összesítő: az utolsó 5 egymás elleni meccs eredménye.

**Miért hasznos:**  
Mélyebb kontextust ad a meccsek köré, növeli az oldalon töltött időt.

**Megvalósítás:**
- API-Football `/fixtures/statistics?fixture={id}` és `/fixtures/headtohead` endpointok
- Új route: `/matches/[id]` részletoldal
- Statisztikák vizualizálása: progress bar-os összehasonlítás (otthon vs vendég)
- H2H: az utolsó 5 meccs kompakt kártyákban
- Caching: 1 óra (lejátszott meccsek adatai nem változnak)

**Megvalósíthatóság:** ✅ Közepes – 2 iteráció, az API végpontok léteznek

---

### 7. Cookie Consent és Analitika

**Leírás:**  
GDPR-kompatibilis cookie banner az első látogatáskor. A felhasználó elfogadhatja az összes sütit, csak a szükségeseket, vagy részletesen konfigurálhatja a preferenciáit. Elfogadás után analitikai sütik (pl. Plausible Analytics – privacy-first, EU-ban hosztolt) aktiválódnak.

**Miért hasznos:**  
GDPR megfelelőség EU-s felhasználók esetén kötelező; az analitika megmutatja, melyik tartalom a legnépszerűbb.

**Megvalósítás:**
- Cookie preferenciák tárolása: `localStorage` (nem szükséges auth)
- Banner komponens: `'use client'`, csak első látogatáskor jelenik meg
- Analitika: [Plausible Analytics](https://plausible.io/) – ingyenes self-host lehetőséggel, nem igényel cookie-t az alap trackinghez, de a kiterjesztett funkciókhoz igen
- Script tag feltételes betöltése: csak elfogadás után injektálódik a `<head>`-be
- Beállítások oldal: `/settings/privacy` – ahol a user visszavonhatja a beleegyezést

**Megvalósíthatóság:** ✅ Könnyű – 1 iteráció; Plausible könnyen integrálható Next.js-be

---

### 8. Webes Push Értesítések

**Leírás:**  
A bejelentkezett felhasználók feliratkozhatnak push értesítésekre: meccs előtti emlékeztető (2 órával a meccs előtt), gól értesítő élő meccs esetén, új hírcikk megjelenésekor értesítés, webshop akció bejelentése.

**Miért hasznos:**  
Visszahozza az inaktív felhasználókat, növeli az elköteleződést anélkül, hogy emailt kellene küldeni.

**Megvalósítás:**
- Web Push API + Service Worker (`public/sw.js`)
- Push subscription tárolása Supabase-ben: `push_subscriptions` tábla (`user_id`, `endpoint`, `keys`)
- Küldés: szerver oldali VAPID-alapú Web Push (npm `web-push` csomag)
- Időzítés: Supabase Edge Function + `pg_cron` – meccs előtt 2 órával automatikus küldés
- Felhasználói beállítás: profil oldalon be/ki kapcsolható kategóriánként

**Megvalósíthatóság:** ⚠️ Összetett – 3 iteráció; Service Worker + Edge Function szükséges, de Web Push standard, minden modern böngésző támogatja (iOS 16.4+)

---

### 9. Gamifikált Pontrendszer: Jelvények és Ranglista

**Leírás:**  
A meglévő pontozási rendszerre épülő gamifikáció: a felhasználók jelvényeket (badge-eket) szereznek aktivitásaikért. Pl. „Első szavazó" (első leadott szavazat), „Hűséges rajongó" (30 nap egymás után bejelentkezés), „Meccs-guru" (10 helyes szavazat), „Vásárló" (első rendelés). A profilon megjelennek a megszerzett jelvények.

**Miért hasznos:**  
A gamifikáció növeli a visszatérő látogatásokat és az aktivitást; a jelvények vizuálisan jelzik a közösségi státuszt.

**Megvalósítás:**
- `badges` tábla: `id`, `name`, `description`, `icon_url`, `condition_type`, `condition_value`
- `user_badges` tábla: `user_id`, `badge_id`, `earned_at`
- Trigger vagy szerver action: minden releváns eseménynél (szavazás, rendelés, bejelentkezés) ellenőrzi, van-e új megszerezhető jelvény
- Profil oldal: jelvény galéria szekció
- Havi Top Szavazók oldal kiterjesztése: jelvények megjelenítése a ranglista mellett
- „Új jelvény szerzett!" toast értesítés

**Megvalósíthatóság:** ✅ Közepes – 2–3 iteráció; a logika egyszerű, a trigger rendszer az összetettebb rész

---

### 10. Személyre Szabható Dashboard

**Leírás:**  
A bejelentkezett felhasználó maga döntheti el, mely widgeteket szeretné látni a dashboardon és milyen sorrendben. Pl. elrejtheti a trófeák szekciót, előre hozhatja a meccseket, vagy a webshop ajánlókat is felveheti. A beállítások mentésre kerülnek és következő bejelentkezéskor is megmaradnak.

**Miért hasznos:**  
Személyes élményt ad, növeli a visszatérési motivációt, és egyedi a versenytársakhoz képest.

**Megvalósítás:**
- `profiles` táblához: `dashboard_layout jsonb DEFAULT '{"order": ["news", "matches", "standings", "players", "trophies", "poll"]}'`
- Drag-and-drop UI: [dnd-kit](https://dndkit.com/) könyvtár (Next.js-kompatibilis, kisméretű)
- „Szerkesztés" mód gomb a dashboardon: drag-and-drop aktiválódik
- Mentés gomb: Server Action frissíti a `dashboard_layout` JSON-t
- Elrejtés lehetőség: minden widget melletti szem ikon be/kikapcsolja

**Megvalósíthatóság:** ✅ Közepes – 2 iteráció; a dnd-kit jól dokumentált, a JSON séma rugalmas

---

### 11. Meccs Tippjáték

**Leírás:**  
A felhasználók az egyes meccsek előtt megtippelhetik a végeredményt (pl. Barcelona 3–1 Real Madrid). A tipp beküldési határideje a meccs kezdete. A meccs után az eredmény alapján pontokat kapnak: pontos tipp = 15 pont, helyes győztes/döntetlen = 5 pont. Az összes tipp leadó a havi ranglistán is megjelenik a szavazós top lista mellett.

**Miért hasznos:**  
Interaktív, visszatérő aktivitást generál minden meccs köré; a felhasználók rendszeresen visszatérnek tippelni.

**Megvalósítás:**
- Új `match_tips` tábla: `user_id`, `match_id` (API-Football fixture ID), `home_score`, `away_score`, `created_at`
- Meccsek oldalon: „Tippelj!" kártya az elkövetkező meccsekhez (csak a meccs kezdete előtt aktív)
- Eredményszámítás: a meccs lejátszása után Supabase Edge Function vagy admin gomb hívja az értékelő logikát
- Pontok jóváírása: a meglévő `profiles.points` mezőre épít (a védett trigger miatt SECURITY DEFINER RPC-vel)
- Saját tippek megtekintése a profil oldalon
- Egyedi szabály: felhasználónként meccsenkénti 1 tipp, szerkesztés a meccs kezdetéig engedélyezett

**Megvalósíthatóság:** ✅ Közepes – 2–3 iteráció; az eredmény kiértékelése igényel egy külön triggert vagy admin akciót

---

### 12. Játékos Összehasonlító

**Leírás:**  
A játékosok oldalon kiválasztható 2 játékos, majd egymás mellett megjelenik a statisztikáik összehasonlítása: mérkőzések, gólok, gólpasszok, sárga lapok, percek. Minden statisztikai sornál vizuálisan kiemelve a jobb értékkel rendelkező játékos.

**Miért hasznos:**  
Kontextust ad a statisztikákhoz; a rajongók imádják összehasonlítani (pl. Lewandowski vs Ferran Torres).

**Megvalósítás:**
- `/players/compare?a={id}&b={id}` route – szerver komponens, párhuzamosan hívja `getPlayerStats(idA)` és `getPlayerStats(idB)`-t
- Összehasonlító táblázat: minden sor = egy statisztika, mindkét érték egymás mellett, a jobb érték félkövér/kiemelve
- Játékos kiválasztó UI: a játékos listáról „Összehasonlítás" gomb → legördülő panel a második játékos kiválasztásához
- Megosztható URL: az összehasonlítás URL-ben kódolt, megosztható link

**Megvalósíthatóság:** ✅ Könnyű – 1 iteráció; a `getPlayerStats` függvény már létezik, csak az összehasonlító UI az új fejlesztés

---

### 13. Jegy Átadás Másik Felhasználónak

**Leírás:**  
A profil oldalon a megvásárolt jegyek mellett megjelenik egy „Jegy átadása" gomb. A felhasználó megadja a célszemély becénevét vagy email-jét, és a jegy átkerül hozzá. Mindkét fél email értesítést kap (opcionálisan push értesítést is).

**Miért hasznos:**  
Ha a vásárló mégsem tud elmenni a meccsre, ne kelljen megtartania a jegyet – barátjának átadhatja az alkalmazáson belül.

**Megvalósítás:**
- `purchased_tickets` táblán: `transferred_to uuid REFERENCES profiles(id)`, `transferred_at timestamptz`
- Server Action: `transferTicket(ticketId, targetNickname)` – megkeresi a célfelhasználót becenév alapján, frissíti a `user_id`-t az `purchased_tickets` táblán
- RLS: az átadás után csak az új tulajdonos látja a jegyet
- UI: Dialog modal a profilon, becenév beviteli mezővel és megerősítő gombbal
- Korlátozás: már átadott jegy nem adható át tovább (egy átadás megengedett)
- Email/push értesítés: Resend API-val (ha az A4 admin ötlet is megvalósult)

**Megvalósíthatóság:** ✅ Közepes – 1–2 iteráció; az RLS frissítése igényel figyelmet, hogy az új tulajdonos biztosan olvashatja a saját jegyét

---

### 14. Teljes Szöveges Hírkereső

**Leírás:**  
A hírek oldalon megjelenik egy keresőmező. A felhasználó szavakat gépel be, és a rendszer valós időben (debounced) visszaadja a releváns cikkeket – a cím és a tartalom alapján keresve. Az eredmények kiemelik a keresett szót a cím szövegében.

**Miért hasznos:**  
Minél több hírcikk gyűlik fel, annál nehezebb navigálni köztük; a kereső alapvető elvárás lett minden tartalomheavy oldalon.

**Megvalósítás:**
- Supabase `ilike` vagy `full-text search` (`to_tsvector` + `to_tsquery`) – utóbbi jobb teljesítményű és pontozásos relevancia-sorrendet ad
- Migrációban: `ALTER TABLE news ADD COLUMN fts tsvector GENERATED ALWAYS AS (to_tsvector('hungarian', coalesce(title,'') || ' ' || coalesce(content,''))) STORED;` + GIN index
- Keresési route: `/news?q=messi` – a szerver oldali query szűr a `fts @@ query` feltétellel
- UI: keresőmező a kategória szűrők mellé helyezve; debounce 300ms; az URL-ben is megjelenik `?q=`
- Kiemelés: a cím szövegben a találat körüli rész félkövérrel kiemelve (`<mark>` tag)

**Megvalósíthatóság:** ✅ Közepes – 1–2 iteráció; Supabase natívan támogatja a PostgreSQL full-text search-t, nincs szükség külső szolgáltatásra

---

### 15. Kedvencek és Olvasási Lista

**Leírás:**  
A felhasználók elkönyvelhetik kedvenc hírcikkeiket és termékeiket egy személyes „Kedvencek" listára. A hírek és a termék részletoldalán megjelenik egy szív / könyvjelző ikon. A profil oldalon külön „Mentett tartalmak" szekció listázza ezeket.

**Miért hasznos:**  
Az olvasó visszatérhet egy cikkhez, amit félbe hagyott; a vásárló félreteheti a terméket, amit még nem akar megvenni – mindkettő növeli a visszatérési arányt.

**Megvalósítás:**
- Új `user_favorites` tábla: `user_id`, `content_type` (`news` / `product`), `content_id uuid`, `created_at` – UNIQUE(user_id, content_type, content_id)
- Szív/könyvjelző gomb: kliens komponens, azonnal tükrözi az állapotot (optimista update)
- Server Action: `toggleFavorite(contentType, contentId)` – ha létezik, törli; ha nem, beszúrja
- Profil oldal: „Mentett hírek" és „Mentett termékek" szekciók a hír/termék kártyák kompakt nézetével
- Hír lista oldalon: opcionális „Csak a mentettjeim" szűrő

**Megvalósíthatóság:** ✅ Könnyű – 1 iteráció; egyszerű CRUD, az optimista UI-update a legösszetettebb rész

---

### 16. Live Match Ticker – Valós Idejű Meccs Eseményfolyam

**Leírás:**  
Meccs közben a meccsek oldalon megnyílik egy élő eseményfolyam panel: minden gól, sárga/piros lap, csere és félidő esemény valós időben jelenik meg egy görgethető idővonalban, percre pontosan jelölve. A gólokat animált konfetti effekt kíséri. A ticker automatikusan bezárul a meccs végén, és az eredmény archiválódik.

**Miért növeli az élményt:**  
A rajongó úgy érezheti, mintha "bent lenne" a meccsben anélkül, hogy tévét kellene néznie. Az oldal élő meccs alatt valódi második képernyővé válik.

**Megvalósítás:**
- API-Football `/fixtures/events?fixture={id}` endpoint – visszaadja az összes eseményt (típus, perc, csapat, játékos)
- Szerver oldali SSE (Server-Sent Events) route: `/api/match-events/[fixtureId]` – 30 másodpercenként polloz az API felé, és az új eseményeket streameli a kliensnek
- Kliens oldal: `EventSource` Web API az SSE olvasáshoz – natív böngésző API, nincs szükség külső könyvtárra
- Eseménytípusonként különböző ikon és szín: ⚽ gól (arany), 🟨 sárga lap, 🟥 piros lap, 🔄 csere
- Gól animáció: [canvas-confetti](https://www.npmjs.com/package/canvas-confetti) npm csomag (2 KB, dependency-free)
- Élő meccs detekció: ha `fixture.status.short === 'LIVE'`, automatikusan megjelenik a ticker szekció
- Archivált események: meccs után Supabase-be mentve, a `/matches/[id]` részletoldalon visszanézhető

**Megvalósíthatóság:** ⚠️ Összetett – 3–4 iteráció; az SSE architektúra és az API rate limit kezelése az összetett rész. API-Football ingyenes tieren a live endpoint korlátozott – megkerülhető szerver oldali cachelással (az SSE route aggregálja a kéréseket, nem minden kliens polloz egyenként)

---

### 17. AI-alapú Személyre Szabott Tartalom-ajánló

**Leírás:**  
Az alkalmazás figyeli, mit olvas, mit néz és mit vásárol a felhasználó, majd ezek alapján személyre szabott javaslatokat kínál: „Neked ajánljuk" hírek szekció a dashboardon, kapcsolódó termékek a webshopban, és hasonló játékosok a játékos részletoldalán. Az ajánlórendszer tanul a viselkedésből, és javul az idő előrehaladtával.

**Miért növeli az élményt:**  
A személyre szabott tartalom drámaian növeli az oldalon töltött időt és a visszatérési arányt – ez az egyik legjobban megtérülő UX fejlesztés.

**Megvalósítás:**
- **Viselkedési naplózás:** `user_events` tábla – `user_id`, `event_type` (`news_view` / `product_view` / `player_view` / `purchase`), `content_id`, `created_at`
- Naplózás: szerver action minden tartalom megnyitásakor (1 esemény/tartalom/nap korláttal, hogy ne inflálódjon)
- **Ajánlóalgoritmus – két megközelítés:**
  - *Egyszerű (collaborative filtering helyett):* az utolsó 10 megtekintett hír kategóriái alapján a Supabase query preferált kategóriákat rendez előre
  - *AI-alapú (komplexebb):* az utolsó 20 interakció elküldhető az OpenRouter API-nak (már integrált), ami természetes nyelvi alapon javasol kapcsolódó tartalmakat
- Dashboard „Neked ajánljuk" szekció: 3 hírkártya, amelyek az előzmények alapján kerülnek kiválasztásra
- Webshop: „Hasonló termékek" szektor a termék részletoldalán (kategória + árkategória alapján)
- Hidegindulás (új user): szerkesztői kiemelések jelennek meg, amíg nincs elég adat

**Megvalósíthatóság:** ⚠️ Összetett – 3–4 iteráció; az egyszerű kategória-alapú verzió 1–2 iteráció, az AI-alapú 3–4. Ajánlott fokozatos megközelítés: előbb a rule-based, majd az AI finomítás.

---

### 18. Interaktív Szezon Statisztika Vizualizáció

**Leírás:**  
Egy dedikált `/season` oldal, amely a teljes La Liga szezon menetét vizualizálja gazdag, interaktív diagramokon: pontok alakulása fordulóról fordulóra (vonaldiagram, összehasonlítva a 2. helyezettel), forma az utolsó 10 meccsben (G/D/V chips), gólkülönbség evolúciója, legtöbb gólt szerző játékosok animált versenysávja (bar chart race stílusban), és az egyes meccsek eredményeire kattintva az adott meccs eseményei jelennek meg.

**Miért növeli az élményt:**  
Az adatok vizuális formában sokkal élvezetesebbek; ez az oldal megosztható, és önmagában is visszacsalogatja a felhasználókat.

**Megvalósítás:**
- Adatforrás: API-Football `/fixtures?season=2024&team=529` – az egész szezon meccseredményei
- Könyvtárak: [Recharts](https://recharts.org/) (vonaldiagram, sávdiagram) + [Framer Motion](https://www.framer.com/motion/) (animációk) – mindkettő Next.js-kompatibilis
- Bar chart race: Framer Motion `layout` animáció – a játékosok sávjai valós időben "versenyeznek" a néző szeme előtt egy időcsúszka húzásával
- Forma chips: az utolsó N meccs `W/D/L` eredmény zöld/szürke/piros csíkok formájában
- Interaktív időcsúszka: a felhasználó visszatekerheti a szezont bármelyik fordulóra
- Szerver oldali adatlekérés: az egész szezon egyszer tölt be (`revalidate: 3600`), kliens oldal csak renderel
- Mobil nézet: egyszerűsített, görgetős kártyák (a komplex diagramok csak asztali nézetben jelennek meg)

**Megvalósíthatóság:** ⚠️ Összetett – 3 iteráció; a Recharts és Framer Motion integrálása viszonylag jól dokumentált, a bar chart race animáció a legkomplexebb rész

---

### 19. Telepíthető PWA Offline Támogatással

**Leírás:**  
A BarcaPulse telepíthető Progressive Web App-ként – a felhasználó a mobilján a kezdőképernyőre teheti, és natív app-szerű élményt kap (splash screen, nincs böngészőcím sáv). Offline módban az utoljára betöltött hírek, meccsidőpontok és a saját jegyek elérhetők maradnak internet-kapcsolat nélkül is. Kapcsolat visszaállásakor a tartalom automatikusan frissül a háttérben.

**Miért növeli az élményt:**  
Mobilon a PWA közel azonos élményt nyújt mint egy natív app, fejlesztési többletköltség nélkül. Az offline elérhetőség különösen értékes stadionban, ahol a hálózat teli lehet.

**Megvalósítás:**
- `next-pwa` csomag – automatikusan generálja a Service Worker-t Next.js projekthez
- `public/manifest.json`: alkalmazásnév, ikon készlet (192×192, 512×512 Barcelona-témájú ikon), `theme_color: "#A50044"`, `display: "standalone"`
- Service Worker cache stratégia:
  - *Hírek listája:* Network-first (friss ha van net, cache fallback ha nincs)
  - *Hír részletoldalak:* Cache-first az utolsó 20 cikknél (Workbox `CacheFirst` + max entries)
  - *Statikus assetök (képek, CSS, JS):* Cache-first örökre
  - *API hívások:* Stale-while-revalidate
- Offline oldal: `public/offline.html` – ha egy oldal sem cache-elt, kedves "Nincs kapcsolat" üzenet jelenik meg Barça-graffikával
- Jegyek offline: a `purchased_tickets` oldal adatai IndexedDB-be is mentésre kerülnek (Workbox `BackgroundSync`)
- Install prompt: egyedi "Telepítsd az alkalmazást" banner az első látogatáskor (`beforeinstallprompt` esemény)

**Megvalósíthatóság:** ⚠️ Összetett – 3 iteráció; a `next-pwa` sokat automatizál, de a cache stratégiák finomhangolása és a Next.js App Router kompatibilitás gondos konfigurálást igényel (a next-pwa v5 beta App Router-rel működik)

---

### 20. Interaktív Rajongói Kvíz AI-Generált Kérdésekkel

**Leírás:**  
Egy dedikált `/quiz` oldal, ahol a felhasználó elindíthat egy kvízkört: 10 kérdés, 30 másodperc/kérdés, valódi idő visszaszámláló. A kérdéseket az OpenRouter AI generálja (már integrált) valós Barcelona statisztikák és történelmi adatok alapján. A végén pontszám összesítő, és a helyes válaszok magyarázatával ellátott visszajelzés. A legjobb eredmények felkerülnek egy globális ranglistára.

**Miért növeli az élményt:**  
A kvíz az egyik legerősebb visszatérési motivátor – a felhasználó újra és újra próbálkozik a jobb eredményért. Az AI-generált kérdések korlátlanul változatosak, soha nem ismétlik magukat.

**Megvalósítás:**
- **Kérdésgenerálás:** OpenRouter API (már integrált) – a prompt tartalmaz Barcelona kontextust (aktuális keret, szezon statisztikák, trófeák, történelmi tények), majd 10 kérdés+4 válaszlehetőség+helyes válasz JSON-t kér
- **Cache:** a generált kérdések Supabase-be mentődnek (`quiz_questions` tábla), így nem minden kvíznél fut AI hívás – egy nap alatt max 20 új kérdéskészlet generálódik, aztán a poolból véletlenszerűen kerülnek ki
- **Játék flow:** 
  1. Start → AI kérdések betöltése (loading spinner)
  2. Kérdésenként 30 mp-es `setInterval` visszaszámláló
  3. Válasz kattintáskor azonnali visszajelzés (zöld/piros kiemelés)
  4. Végeredmény képernyő: pontszám, "Újra" gomb, pontok jóváírása
- **Pontrendszer:** helyes válasz = 10 pont, de időbónusz is: minél hamarabb válaszol, annál több pontot kap (max 15/kérdés)
- **Ranglista:** `quiz_results` tábla – legjobb pontszámok heti/havi bontásban, a havi ranglistával összevonva opcionálisan
- **Kliens oldal:** teljesen kliens oldali (`'use client'`) a visszaszámlálók és animációk miatt; kérdések egyetlen szerver hívással töltődnek

**Megvalósíthatóság:** ⚠️ Összetett – 3–4 iteráció; a legkomplexebb rész az AI prompt mérnöklése (hogy konzisztens JSON formátumú és pontos kérdéseket adjon), valamint a kérdés-pool kezelése. Az OpenRouter integráció már megvan, ami jelentősen leegyszerűsíti a backend részt.

---

## Admin oldal (5 ötlet)

---

### A1. Analitikai Dashboard Diagramokkal

**Leírás:**  
Az admin áttekintő oldal kibővül interaktív diagramokkal: regisztrált felhasználók száma az idő függvényében (vonaldiagram), legnépszerűbb hírcikkek (olvasottság szerint), webshop bevétel hetente/havonta (oszlopdiagram), jegyek szektoros eladottság megoszlása (kördiagram).

**Miért hasznos:**  
A számszerű statisztikák helyett vizuálisan is átlátható üzleti teljesítmény-kép.

**Megvalósítás:**
- [Recharts](https://recharts.org/) könyvtár – Next.js-sel kompatibilis, React-alapú
- Adat forrás: Supabase aggregáló query-k (GROUP BY dátum, COUNT, SUM)
- Dátumszűrő: utolsó 7 nap / 30 nap / 90 nap / idei év
- Exportálás: CSV letöltés gomb (kliens oldali, `Blob` API-val)

**Megvalósíthatóság:** ✅ Közepes – 2 iteráció

---

### A2. Ütemezett Hírek és Tartalom Naptár

**Leírás:**  
A hírek szerkesztőjébe kerül egy „Közzététel időpontja" mező. Ha ez be van állítva, a cikk csak az adott időponton válik publikussá automatikusan (az adminnak nem kell manuálisan átállítani). Az admin felületen naptárnézet mutatja az ütemezett publikációkat.

**Miért hasznos:**  
Az admin előre megírhatja a cikkeket (pl. meccs előzetes), és pontosan a meccs napján, adott órában jelenik meg automatikusan.

**Megvalósítás:**
- `news` táblához: `scheduled_at timestamptz` mező (ha kitöltött, csak ekkor válik láthatóvá)
- A hírek lekérő query kiegészítése: `published = true AND (scheduled_at IS NULL OR scheduled_at <= now())`
- Naptár UI: [react-big-calendar](https://github.com/jquense/react-big-calendar) vagy egyszerűbb egyéni megoldás
- Alternatíva az automatikus közzétételre: Supabase Edge Function + `pg_cron` – percenként ellenőrzi és átállítja a `published` flag-et

**Megvalósíthatóság:** ✅ Közepes – 2 iteráció

---

### A3. Chat Moderáció és AI-alapú Szűrés

**Leírás:**  
Az admin felületen megjelenik a chat üzenetek moderációs oldala: listázza az összes üzenetet, jelöli az AI által gyanúsként megjelölt tartalmakat (sértő szavak, spam, nem tematikus szövegek), és lehetővé teszi az üzenetek törlését, a felhasználó ideiglenes eltiltását (chat-ban).

**Miért hasznos:**  
A nyilvános chat moderáció nélkül könnyen eldurvulhat; az AI szűrő csökkenti a manuális terhelést.

**Megvalósítás:**
- Moderáció: `chat_messages` táblához `is_flagged boolean DEFAULT false`, `deleted_at timestamptz`
- AI szűrő: az üzenet beküldésekor az OpenRouter API (már integrált) rövid moderációs prompt-tal ellenőrzi a tartalmat (pl. „Sértő vagy spam ez az üzenet? Igen/Nem")
- Ha `is_flagged = true`, az üzenet halványítva vagy elrejtve jelenik meg a chatben, amíg az admin dönt
- Admin felület: szűrhető táblázat (összes / gyanús / törölt)
- Chat-ban: `profiles` táblához `chat_banned_until timestamptz` mező; a `sendMessage` action ellenőrzi

**Megvalósíthatóság:** ⚠️ Összetett – 2–3 iteráció; az AI moderáció késleltetést okozhat az üzenet megjelenésében, ezt kezelni kell (optimista megjelenítés + utólagos szűrés)

---

### A4. Hírlevél Küldés Regisztrált Felhasználóknak

**Leírás:**  
Az admin egy egyszerű szerkesztőfelületen email hírleveleket küldhet a felhasználóknak: új termék bejelentés, akció hirdetés, meccs emlékeztető. A felhasználók a profilukon leiratkozhatnak.

**Miért hasznos:**  
Közvetlen kommunikációs csatorna a rajongókkal; a push értesítéseknél szélesebb körben elérhető.

**Megvalósítás:**
- Email küldő szolgáltatás: [Resend](https://resend.com/) – Next.js-hez optimalizált, ingyenes tier 3000 email/hó
- `profiles` táblához: `email_subscribed boolean DEFAULT true`
- Admin felület: tárgy, HTML törzs (rich text editor: `@tiptap/react`), célcsoport választó (mindenki / csak aktív / stb.)
- Küldés: Next.js Server Action → Resend API → tömeges küldés batch-ekben (Resend batch endpoint)
- Leiratkozás: profil oldalon toggle + leiratkozási link az emailben (egyedi token)

**Megvalósíthatóság:** ✅ Közepes – 2 iteráció; Resend integrálása egyszerű

---

### A5. Készlet Kezelés és Alacsony Készlet Figyelmeztetés

**Leírás:**  
A termékek listájában megjelenik a pontos készletszint vizuálisan (zöld/sárga/piros jelző). Ha egy termék készlete egy beállítható küszöb alá esik (pl. 5 db), az admin email értesítést kap és az admin felületen figyelmeztető badge jelenik meg. Lehetőség van a termék automatikus „elfogyott" státuszra állítására nulla készletnél.

**Miért hasznos:**  
Megakadályozza, hogy egy termék láthatóan kapható legyen, miközben nincs belőle készlet; csökkenti az adminisztrációs terhet.

**Megvalósítás:**
- `products` táblához: `low_stock_threshold integer DEFAULT 5`; `stock` már létezik
- Admin termék lista: készletszint oszlop színkódolt jelzővel (`stock === 0` piros, `stock <= threshold` sárga, egyébként zöld)
- Automatikus státusz: Supabase DB trigger – ha `stock` 0-ra csökken, `available boolean` flag `false`-ra állítódik (ha a séma tartalmazza)
- Értesítés küldés: Supabase Database Webhook → Next.js API route → Resend email az admin email címére
- Admin felületen összesítő: „Alacsony készletű termékek" szekció az áttekintő oldalon

**Megvalósíthatóság:** ✅ Könnyű-Közepes – 1–2 iteráció; a DB trigger + webhook a legegyszerűbb megközelítés

---

## Összefoglaló Táblázat

| # | Funkció | Terület | Megvalósíthatóság |
|---|---------|---------|-------------------|
| 1 | Termékértékelések | Webshop | ✅ Közepes |
| 2 | Népszerűségi sorrend | Webshop | ✅ Könnyű |
| 3 | Akciók és visszaszámláló | Webshop | ✅ Közepes |
| 4 | AR Mez Felpróbáló | Webshop | ⚠️ Összetett |
| 5 | Élő meccsstatisztikák | Meccsek | ✅ Közepes |
| 6 | Részletes meccs + H2H | Meccsek | ✅ Közepes |
| 7 | Cookie consent + analitika | Általános | ✅ Könnyű |
| 8 | Web Push értesítések | Általános | ⚠️ Összetett |
| 9 | Jelvények és gamifikáció | Közösség | ✅ Közepes |
| 10 | Személyre szabható dashboard | Dashboard | ✅ Közepes |
| 11 | Meccs tippjáték | Meccsek/Közösség | ✅ Közepes |
| 12 | Játékos összehasonlító | Játékosok | ✅ Könnyű |
| 13 | Jegy átadás másik usernek | Jegyek | ✅ Közepes |
| 14 | Teljes szöveges hírkereső | Hírek | ✅ Közepes |
| 15 | Kedvencek és olvasási lista | Általános | ✅ Könnyű |
| 16 | Live Match Ticker – valós idejű eseményfolyam | Meccsek | ⚠️ Összetett |
| 17 | AI személyre szabott tartalom-ajánló | Általános | ⚠️ Összetett |
| 18 | Interaktív szezon statisztika vizualizáció | Meccsek | ⚠️ Összetett |
| 19 | Telepíthető PWA offline támogatással | Általános | ⚠️ Összetett |
| 20 | Rajongói kvíz AI-generált kérdésekkel | Közösség | ⚠️ Összetett |
| A1 | Analitikai diagramok | Admin | ✅ Közepes |
| A2 | Ütemezett tartalom naptár | Admin | ✅ Közepes |
| A3 | Chat moderáció + AI szűrő | Admin | ⚠️ Összetett |
| A4 | Hírlevél küldés | Admin | ✅ Közepes |
| A5 | Készletkezelés és értesítés | Admin | ✅ Könnyű-Közepes |
