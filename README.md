# FC Barcelona Szurkolói Portál

Fullstack Next.js webalkalmazás — hírportál, webshop, jegyértékesítés, játékos-adatbázis, közösségi feed, szavazórendszer és admin analitika egyetlen platformon. Szakdolgozat projekt.

## Tech Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS v4)
- **Supabase** (PostgreSQL, Auth, RLS, Storage)
- **Framer Motion + GSAP** animációk
- **Tiptap** rich text editor (admin CMS)
- **Recharts** admin analitika dashboard

---

## Előfeltételek

- Node.js 18+
- Supabase projekt (fiók szükséges: [supabase.com](https://supabase.com))
- API-Football kulcs (opcionális, meccs- és játékosadatokhoz): football-data.org

---

## Telepítés és indítás

### 1. Függőségek telepítése

```bash
npm install
```

### 2. Környezeti változók beállítása

```bash
cp .env.local.example .env.local
```

Töltsd ki a `.env.local` fájlt a Supabase projekt adataival (Settings → API):

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Opcionális
API_FOOTBALL_KEY=<api-football-key>
```

### 3. Adatbázis séma alkalmazása

A `supabase/migrations/` mappában lévő SQL fájlokat sorban futtasd le a Supabase SQL szerkesztőjében (vagy Supabase CLI-vel):

```bash
# Supabase CLI-vel (ha telepítve van):
supabase db push
```

A migrációk sorrendje: `001_storage_buckets.sql` → `021_fix_security_definer_warnings.sql`

### 4. Fejlesztői szerver indítása

```bash
npm run dev
```

Az alkalmazás elérhető: [http://localhost:3000](http://localhost:3000)

---

## Elérhető szkriptek

| Parancs | Leírás |
|---|---|
| `npm run dev` | Fejlesztői szerver (hot reload) |
| `npm run build` | Produkciós build |
| `npm run start` | Produkciós szerver indítása (build után) |
| `npm run lint` | ESLint ellenőrzés |

---

## Admin hozzáférés

Regisztráció után az admin role-t manuálisan kell beállítani a Supabase Table Editornál:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'sajat@email.com';
```

Az `/admin` útvonalak csak `admin` role-lal érhetők el.
