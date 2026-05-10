# E2E tesztek — FC Barcelona Szurkolói Portál

Playwright-alapú végponttól végpontig (E2E) tesztek, amelyek a teljes alkalmazást valódi böngészőn keresztül, éles Supabase-kapcsolattal tesztelik.

---

## Előfeltételek

- Node.js 18+ és a projekt függőségei telepítve (`npm install`)
- Playwright böngészők letöltve (lásd Telepítés)
- A Next.js fejlesztői szerver fut (`npm run dev`)
- A Supabase projekt elérhető (lokális vagy hosted)
- Érvényes tesztfiókok léteznek a Supabase Auth-ban (lásd Tesztfiókok)

---

## Telepítés

```bash
npx playwright install
```

Ez letölti a Chromium böngészőt, amelyen a tesztek futnak.

---

## Env változók beállítása

Hozz létre egy `.env.local` fájlt a projekt gyökerében (ha még nem létezik), és add hozzá a következő sorokat:

```env
TEST_USER_EMAIL=teszt@example.com
TEST_USER_PASSWORD=tesztelszó123

TEST_ADMIN_EMAIL=admin@example.com
TEST_ADMIN_PASSWORD=adminjelszó123

# Opcionális — alapértelmezett: https://szakdolgozatfcb.vercel.app
BASE_URL=http://localhost:3000
```

A `playwright.config.ts` automatikusan beolvassa a `.env.local` fájlt, nincs szükség shell-szintű exportálásra.

---

## Tesztfiókok létrehozása

### Normál felhasználói fiók

1. Nyisd meg a Supabase Dashboard > Authentication > Users oldalt.
2. Kattints az "Invite user" vagy "Create user" gombra.
3. Add meg az emailt és a jelszót (ezek kerülnek `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` értékekként).
4. Az újonnan létrehozott fiókhoz a `profiles` táblában automatikusan létrejön egy sor `role = 'user'` értékkel — ezt nem kell kézzel beállítani.

### Admin fiók

1. Hozz létre egy felhasználót az előző lépések szerint.
2. A Supabase Dashboard > Table Editor > `profiles` táblában keresd meg az új felhasználó sorát (az `id` egyezik az Auth user `id`-jával).
3. Módosítsd a `role` mező értékét `'user'`-ről `'admin'`-ra, majd mentsd el.
4. Ezek az adatok kerülnek `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` értékekként.

---

## Tesztek futtatása

### Összes teszt futtatása

```bash
npx playwright test
```

### Headed mód (látható böngészőablakkal)

```bash
npx playwright test --headed
```

### Egy adott mappa / spec fájl futtatása

```bash
npx playwright test tests/e2e/shop/
npx playwright test tests/e2e/auth/login.spec.ts
```

### Interaktív UI mód

```bash
npx playwright test --ui
```

### HTML riport megtekintése

```bash
npx playwright show-report
```

---

## Tesztstruktúra

| Mappa | Mit fed le |
|---|---|
| `admin/` | Admin felület: termékek, rendelések, játékosok, cikkek, kupakódok, szavazások, értékelések, meccsek, analitika |
| `auth/` | Bejelentkezés, kijelentkezés, regisztráció, admin útvonal-védelem |
| `community/` | Közösségi hírfolyam, követés, direkt üzenetek |
| `dashboard/` | Főoldali dashboard widgetek |
| `dream-team/` | Álomcsapat-összeállító |
| `home/` | Publikus landing oldal |
| `news/` | Hírportál, cikkek böngészése |
| `players/` | Játékos-statisztikák böngészése |
| `points/` | Hűségpontok, kuponbeváltás |
| `polls/` | Szavazások |
| `profile/` | Profil szerkesztése, kívánságlista, jegyek, pontok, kuponjaim |
| `shop/` | Webshop: termékböngészés, kosár, pénztár |
| `tickets/` | Jegyek böngészése és vásárlása |
| `fixtures/` | Megosztott auth fixture (`userPage`, `adminPage`) |
| `helpers/` | Navigációs segédfüggvények |

---

## Ismert korlátok

- **Valódi Supabase-kapcsolat szükséges.** A tesztek nem használnak mock-ot vagy in-memory adatbázist — élő Supabase projekthez csatlakoznak. Mock-kal való futtatás nem támogatott.
- **Szekvenciális futtatás.** A `playwright.config.ts`-ben `workers: 1` van beállítva, hogy az adatbázis-műveletek ne interferáljanak egymással. Párhuzamos futtatás adatkonzisztencia-problémákat okozhat.
- **Tesztadatok izolációja.** A tesztek nem törlik maguk után az adatbázis-bejegyzéseket — érdemes dedikált tesztkörnyezetet (pl. elkülönített Supabase projektet) használni.
- **Csak Chromium.** A konfiguráció egyetlen `chromium` projektet definiál; Firefox és WebKit futtatása nincs konfigurálva.
- **Google OAuth.** A Google bejelentkezési flow nem automatizálható E2E tesztekkel (valódi consent screen szükséges). Az OAuth gomb jelenlétét és aktiválhatóságát a teszt ellenőrzi, de a teljes flow-t nem.
- **Checkout tesztek valódi rendelést hoznak létre.** A `checkout.spec.ts` "Megrendelés (demo)" tesztje valódi sort ír a Supabase `orders` táblába — dedikált tesztfiókot ajánlott használni.
- **Dream Team mentés** csak akkor fut végig, ha legalább egy játékos el van helyezve a pályán. Üres pálya esetén a teszt skip-elődik.

## Implementációs megjegyzések (fejlesztőknek)

- **Kijelentkezés után** az `AuthProvider.signOut()` a `/` landing oldalra irányít (nem `/login`-ra).
- **Védelemtípusok:** ProtectedRoute (`/dashboard`, `/profil` stb.) → `?returnUrl=`; middleware (`/admin`) → `?redirect=`.
- **FormationSelector:** `role="radiogroup"` + `role="radio"` gombok — nem `role="button"`.
- **Checkout:** 2 lépéses flow. 1. lépés: szállítási form (submit: "Tovább az összegzéshez"). 2. lépés: összegzés (submit: "Megrendelés (demo)").
