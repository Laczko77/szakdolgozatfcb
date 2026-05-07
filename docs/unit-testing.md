# Unit Tesztelés — Dokumentáció

## Áttekintés

A projekt **1115 Vitest unit tesztet** tartalmaz **43 tesztfájlban**, amelyek a `src/` mappa pure TypeScript függvényeit, osztályait, konstansait, valamint mockolható lib moduljait, React hookjait, providereit és komponenseit fedik le. A tesztek determinisztikusak: a Supabase, Next.js és böngésző API függőségek mock-okkal vannak izolálva.

**Végeredmény:**
```
1115 teszt
1115 passed ✓
   0 skipped
   0 failed ✗

Futási idő: ~18s
```

**Coverage (a teljes `src/`-re):**
- Statements: **97.48%** (388/398)
- Branches: 42%+
- Functions: 54%+
- Lines: 58%+

---

## Tesztfájlok és lefedettség

### Eredeti tesztek (23 fájl — 620 teszt)

| Fájl | Terület | Forrásmodul | Tesztek |
|---|---|---|---|
| `tests/unit/lib/format.test.ts` | Ár, dátum és datetime formázás | `src/lib/format.ts` | 25 |
| `tests/unit/lib/html-excerpt.test.ts` | HTML strip, entity dekód, truncation | `src/lib/html-excerpt.ts` | 24 |
| `tests/unit/lib/rate-limit.test.ts` | Token-bucket rate limiter, client key | `src/lib/rate-limit.ts` | 32 |
| `tests/unit/lib/dream-team-formations.test.ts` | Felállás struktúra, slot logika | `src/lib/dream-team-formations.ts` | 60 |
| `tests/unit/lib/coupons.test.ts` | Kedvezmény kalkuláció | `src/lib/coupons.ts` | 16 |
| `tests/unit/lib/constants.test.ts` | ArticleCategory és PlayerPosition type guardok | `src/lib/constants.ts` | 25 |
| `tests/unit/lib/utils.test.ts` | Tailwind class merge | `src/lib/utils.ts` | 14 |
| `tests/unit/lib/football-data.test.ts` | Szezon évszám meghatározás | `src/lib/football-data.ts` | 12 |
| `tests/unit/lib/transaction-reasons.test.ts` | Pont tranzakció feliratozás (i18n) | `src/lib/i18n/transaction-reasons.ts` | 22 |
| `tests/unit/lib/sectors.test.ts` | Szektor type guard, konstans integritás | `src/lib/constants/sectors.ts` | 23 |
| `tests/unit/lib/consent.test.ts` | GDPR consent localStorage kezelés | `src/lib/consent.ts` | 37 |
| `tests/unit/lib/storage.test.ts` | URL-ből fájlnév kinyerés, mockolható Supabase | `src/lib/storage.ts` | 11 |
| `tests/unit/lib/admin-fetch.test.ts` | Admin API error osztály, fetch wrapper | `src/lib/admin-fetch.ts` | 23 |
| `tests/unit/lib/player-positions.test.ts` | Játékos pozíció label map-ek | `src/lib/player-positions.ts` | 23 |
| `tests/unit/lib/points.test.ts` | Pont rendszer konstansok | `src/lib/points.ts` | 8 |
| `tests/unit/lib/motion.test.ts` | Framer Motion Variants konstansok | `src/lib/animation/motion.ts` | 48 |
| `tests/unit/lib/navigation.test.ts` | Route aktív állapot, nav konfig | `src/components/layout/navigation.config.ts` | 34 |
| `tests/unit/lib/dream-team-validation.test.ts` | Dream Team payload validáció (POST/PUT) | `src/app/api/dream-team/_validation.ts` | 69 |
| `tests/unit/lib/match-status.test.ts` | Meccs státusz deriválás dátumból | `src/components/tickets/MatchStatusBadge.tsx` | 20 |
| `tests/unit/lib/own-reaction-key.test.ts` | Reakció cache kulcs generálás | `src/types/social.ts` | 13 |
| `tests/unit/lib/admin-sidebar.test.ts` | Admin nav aktív elem keresés | `src/components/admin/AdminSidebar.tsx` | 26 |
| `tests/unit/lib/poll-options.test.ts` | Szavazás opció validáció és none-flag logika | `src/app/api/admin/polls/route.ts` | 45 |
| `tests/unit/lib/variants-editor.test.ts` | Termék variáns factory függvény | `src/components/admin/products/VariantsEditor.tsx` | 11 |

### Helper modul tesztek (9 fájl — 140 teszt)

| Fájl | Terület | Forrásmodul (helper) | Tesztek |
|---|---|---|---|
| `tests/unit/lib/search-helpers.test.ts` | ILIKE escape, integer clamp | `src/app/api/search/_helpers.ts` | 21 |
| `tests/unit/lib/coupon-redeem-helpers.test.ts` | Postgres P0001 hiba → HTTP státusz mapping | `src/app/api/shop/coupons/[id]/redeem/_helpers.ts` | 10 |
| `tests/unit/lib/profile-helpers.test.ts` | FormData `readFile` / `readBool` helper | `src/app/api/profile/_helpers.ts` | 15 |
| `tests/unit/lib/orders-helpers.test.ts` | Szállítási cím validáció, coupon_code kinyerés | `src/app/api/orders/_helpers.ts` | 29 |
| `tests/unit/lib/purchase-validation.test.ts` | Jegyvásárlási payload validáció | `src/app/api/tickets/purchase/_helpers.ts` | 17 |
| `tests/unit/lib/countdown.test.ts` | Visszaszámláló időegység-lebontás | `src/hooks/useCountdown.helpers.ts` | 10 |
| `tests/unit/lib/relative-time.test.ts` | Magyar relatív idő szöveg generálás | `src/components/social/RelativeTime.helpers.ts` | 13 |
| `tests/unit/lib/stadium-map.test.ts` | Stadion szektor slot map, accessibility leírás | `src/components/tickets/StadiumMap.helpers.ts` | 12 |
| `tests/unit/lib/page-tracking.test.ts` | UUID kinyerés `/shop/<uuid>` pathname-ből | `src/hooks/usePageTracking.helpers.ts` | 13 |

### Mockolható lib fájlok (Supabase `vi.mock`-kal — 3 fájl + meglévő bővítések — 75 teszt)

| Fájl | Terület | Forrásmodul | Tesztek |
|---|---|---|---|
| `tests/unit/lib/sectors-seed.test.ts` | Stadion szektor seed és upsert logika | `src/lib/sectors-seed.ts` | 18 |
| `tests/unit/lib/api-utils.test.ts` | Egységes API válasz-, hibakezelő- és validátor utility-k | `src/lib/api-utils.ts` | 28 |
| `tests/unit/lib/auth.test.ts` | Auth hozzáférés-vezérlő helperek (getCurrentUser, requireRole) | `src/lib/auth.ts` | 29 |

### React hookok (RTL `renderHook` — 3 fájl — 40 teszt)

| Fájl | Terület | Forrásmodul | Tesztek |
|---|---|---|---|
| `tests/unit/hooks/useReducedMotion.test.ts` | `prefers-reduced-motion` media query követés | `src/hooks/useReducedMotion.ts` | 8 |
| `tests/unit/hooks/useMediaQuery.test.ts` | Általános media query hook | `src/hooks/useMediaQuery.ts` | 12 |
| `tests/unit/hooks/useFeedPolling.test.ts` | Időzített feed polling (fake timers) | `src/hooks/useFeedPolling.ts` | 20 |

### React providerek (RTL `render` + `userEvent` — 3 fájl — 51 teszt)

| Fájl | Terület | Forrásmodul | Tesztek |
|---|---|---|---|
| `tests/unit/providers/SearchProvider.test.tsx` | Globális kereső paletta context, billentyű shortcutok | `src/providers/SearchProvider.tsx` | 15 |
| `tests/unit/providers/CartProvider.test.tsx` | Kosár state management, perzisztencia | `src/providers/CartProvider.tsx` | 21 |
| `tests/unit/providers/ConsentProvider.test.tsx` | GDPR consent context, banner state | `src/providers/ConsentProvider.tsx` | 15 |

### React komponensek (RTL `render` — 2 fájl — 46 teszt)

| Fájl | Terület | Forrásmodul | Tesztek |
|---|---|---|---|
| `tests/unit/components/RatingStars.test.tsx` | Termék értékelés csillag komponens (interaktív + read-only) | `src/components/shop/RatingStars.tsx` | 25 |
| `tests/unit/components/PollResultBar.test.tsx` | Szavazás eredmény progress bar megjelenítés | `src/components/polls/PollResultBar.tsx` | 21 |

---

## Tesztek futtatása

```bash
# Teljes suite
npx vitest run

# Csak egy fájl
npx vitest run tests/unit/lib/format.test.ts

# Watch mód (fejlesztés közben)
npx vitest

# Coverage riport generálása
npx vitest run --coverage
```

A coverage riport elérhető: `coverage/index.html`

---

## Konfiguráció (`vitest.config.ts`)

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/unit/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/lib/supabase/**', 'src/lib/**/*-api.ts'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

**Fontos beállítások:**
- `environment: 'node'` az alapértelmezett — a böngésző API-t igénylő tesztek (React hookok, providerek, komponensek) fájlonként `// @vitest-environment jsdom` docblock-kal opt-inolnak jsdom-ba
- `setupFiles: ['tests/unit/setup.ts']` — `@testing-library/jest-dom` matcher-ek (pl. `toBeInTheDocument`) globális regisztrációja
- `include` `*.test.{ts,tsx}` mintát használ, hogy a TSX fájlban írt komponens- és provider-tesztek is futhassanak
- `globals: true` — a `describe`, `it`, `expect`, `vi` importok nélkül elérhetők
- `@/` path alias — megegyezik a Next.js projekt konfigurációjával

---

## Helper modulok (tesztelhetőség érdekében kiemelve)

A route handlerek és komponensek private pure függvényeit sibling `_helpers.ts` / `.helpers.ts` fájlokba emeltük ki — ez a projekt meglévő `src/app/api/dream-team/_validation.ts` konvencióját követi. A route handlerek és komponensek ezeket importálják, a viselkedés változatlan.

| Helper modul | Exportált függvények | Eredeti hely |
|---|---|---|
| `src/app/api/search/_helpers.ts` | `escapeIlike`, `clampInt` | `src/app/api/search/route.ts` |
| `src/app/api/shop/coupons/[id]/redeem/_helpers.ts` | `mapBusinessRuleError` | `src/app/api/shop/coupons/[id]/redeem/route.ts` |
| `src/app/api/profile/_helpers.ts` | `readFile`, `readBool` | `src/app/api/profile/route.ts` |
| `src/app/api/orders/_helpers.ts` | `parseShippingAddress`, `parseOptionalCouponCode` | `src/app/api/orders/route.ts` |
| `src/app/api/tickets/purchase/_helpers.ts` | `parsePurchasePayload`, `PurchasePayload` | `src/app/api/tickets/purchase/route.ts` |
| `src/hooks/useCountdown.helpers.ts` | `computeParts`, `CountdownParts` | `src/hooks/useCountdown.ts` |
| `src/hooks/usePageTracking.helpers.ts` | `extractProductId` | `src/hooks/usePageTracking.ts` |
| `src/components/social/RelativeTime.helpers.ts` | `toRelativeHu` | `src/components/social/RelativeTime.tsx` |
| `src/components/tickets/StadiumMap.helpers.ts` | `buildSlotMap`, `describeSector` | `src/components/tickets/StadiumMap.tsx` |

---

## Mock stratégiák

A tesztek hét mock technikát alkalmaznak a külső függőségek izolálásához:

### 1. Modul mock (`vi.mock`)
Supabase és Next.js modulok kizárása az importból:
```typescript
vi.mock('@/lib/supabase/server', () => ({ createServiceRoleClient: vi.fn() }))
vi.mock('next/server', () => ({ NextResponse: { json: vi.fn() } }))
vi.mock('lucide-react', () => ({ Home: () => null, /* ... */ }))
```

### 2. Globális `fetch` mock (`vi.stubGlobal`)
Az `admin-fetch.ts` teszteléséhez:
```typescript
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)
mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: result }) })
```

### 3. `window` / `localStorage` mock (node environment-ben)
A `consent.ts` böngésző-függő függvényeihez:
```typescript
const localStorageMock = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() }
;(globalThis as any).window = { localStorage: localStorageMock, dispatchEvent: vi.fn() }
```

### 4. Fake timers (`vi.useFakeTimers`)
Az időalapú logika teszteléséhez (`rate-limit.ts` token refill, `countdown.ts` időegység-lebontás, `useFeedPolling` interval):
```typescript
vi.useFakeTimers()
vi.setSystemTime(new Date('2025-06-01T12:00:00Z'))
vi.advanceTimersByTime(1100) // 1.1 másodpercet szimulál
vi.useRealTimers()
```

### 5. React Testing Library (`render` + `renderHook`)
React hookok, providerek és komponensek teszteléséhez (jsdom environment-ben):
```typescript
import { render, screen, renderHook, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { result } = renderHook(() => useSearchPalette(), { wrapper: SearchProvider })
await userEvent.keyboard('{Control>}k{/Control}')
```

### 6. Framer Motion mock
A komponens-tesztekben az animációs library statikus DOM-ra cserélve:
```typescript
vi.mock('framer-motion', () => ({
  motion: { div: React.forwardRef(({ children, ...props }, ref) => <div ref={ref} {...props}>{children}</div>) },
  AnimatePresence: ({ children }) => children,
}))
```

### 7. Supabase chain mock
A query builder fluent láncának teljes mockolása lib-fájl tesztekhez:
```typescript
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: { /* ... */ }, error: null }),
}
```

---

## Mi nem tesztelhető unit teszttel

| Kategória | Ok |
|---|---|
| `src/app/api/**/route.ts` handlerek | Next.js `NextRequest`/`NextResponse` + Supabase I/O integrált összjáték (de a belőlük kiemelt `_helpers.ts` fájlok tesztelhetők) |
| `src/lib/supabase/*.ts` | Supabase client inicializáció (env változók + SDK belső állapot) |
| `src/lib/*-api.ts` fájlok | Vékony fetch wrapperek a kliens-oldali rétegben (coverage-ből is kizárva) |
| `src/middleware.ts` | Next.js edge runtime + Supabase auth, integrációs szintű |
| `src/hooks/useAuthUser.ts` | Thin wrapper a Supabase auth state fölött, nincs önálló üzleti logika |
| Vizuális/layout `.tsx` komponensek zöme | Minimális logika, túlnyomóan JSX markup és Tailwind osztályok |

---

## Azonosított és javított hibák

### 1. Array body nem kezelt a dream team validátorban

**Probléma:** A `validateDreamTeamPayload` típusellenőrzése (`typeof body !== 'object' || body === null`) nem szűrte ki a tömb típusú body-t, mivel JavaScript-ben `typeof [] === 'object'` és `[] !== null`. Emiatt tömb input esetén a validátor nem `'Érvénytelen kérés'` hibával tért vissza, hanem a `formation` kötelező mezőjének hiányát jelezte.

**Érintett fájl:** `src/app/api/dream-team/_validation.ts:45`

**Tünet:**
```typescript
validateDreamTeamPayload([], { partial: false })
// Elvárt: { ok: false, error: 'Érvénytelen kérés' }
// Kapott: { ok: false, error: 'A "formation" mező kötelező' }
```

**Javítás:**
```typescript
// Előtte:
if (typeof body !== 'object' || body === null) {

// Utána:
if (typeof body !== 'object' || body === null || Array.isArray(body)) {
```

---

### 2. Trailing slash URL viselkedés dokumentálva (`fileNameFromUrl`)

**Megfigyelés:** A `fileNameFromUrl('https://example.com/files/')` hívás `'files'`-t ad vissza, nem üres stringet. A `pathname.split('/').filter(Boolean)` kiszűri a trailing üres szegmenst, így az utolsó nem-üres szegmens kerül visszaadásra. Ez nem bug — a tesztek a tényleges viselkedést dokumentálják.

**Érintett fájl:** `src/lib/storage.ts`
