# Unit tesztek — FC Barcelona Szurkolói Portál

Vitest-alapú egységtesztek, amelyek a projekt tiszta TypeScript/JavaScript függvényeit, hookjait, providereit és komponenseit tesztelik — hálózati kapcsolat és adatbázis nélkül.

---

## Előfeltételek

- Node.js 18+ és a projekt függőségei telepítve (`npm install`)
- Nincs szükség futó szerverre, Supabase-kapcsolatra vagy env változókra

---

## Tesztek futtatása

### Összes unit teszt

```bash
npm run test:unit
```

### Watch mód (fejlesztés közben)

```bash
npm run test:unit -- --watch
```

### Egy adott fájl futtatása

```bash
npx vitest run tests/unit/lib/format.test.ts
```

### Coverage riport generálása

```bash
npm run test:unit -- --coverage
```

A riport a `coverage/` mappába kerül. A lefedettség a `src/lib/**/*.ts` fájlokra vonatkozik (a Supabase kliens wrapper-ek és külső API-hívók ki vannak zárva).

### Interaktív UI mód

```bash
npx vitest --ui
```

---

## Tesztstruktúra

| Mappa | Mit fed le |
|---|---|
| `lib/` | Tiszta segédfüggvények: formázás, validáció, számítások, konstansok, üzleti logika |
| `hooks/` | React hook-ok izolált tesztelése (`useMediaQuery`, `useReducedMotion`, `useFeedPolling`) |
| `providers/` | Context providerek és azok állapotkezelése (`CartProvider`, `SearchProvider`, `ConsentProvider`) |
| `components/` | Önálló, logikával rendelkező UI komponensek (`RatingStars`, `PollResultBar`) |
| `setup.ts` | Globális tesztkonfiguráció — `@testing-library/jest-dom` matcherek betöltése |

---

## Konfiguráció

A teszteket a projekt gyökerében lévő `vitest.config.ts` vezérli:

- **Környezet:** `node`
- **Globals:** engedélyezve (`describe`, `it`, `expect` import nélkül használható)
- **Setup fájl:** `tests/unit/setup.ts`
- **Coverage provider:** `v8`
- **Path alias:** `@` → `src/`

---

## Ismert korlátok

- **Csak izolált logika.** Supabase-t, Next.js router-t vagy külső API-t hívó kódot ezek a tesztek nem fednek le — azokhoz E2E teszt szükséges.
- **Nincs párhuzamossági korlát.** A unit tesztek állapotmentesek, párhuzamosan futtathatók — a `workers` nincs korlátozva.
- **Komponens tesztek jsdom nélkül.** A `vitest.config.ts` `node` environment-et használ; a Testing Library render hívásai a `jsdom` automatikus polyfill-jére támaszkodnak, amelyet a Vitest a `@testing-library/react` telepítésekor biztosít.
