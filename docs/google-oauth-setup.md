# Google OAuth Beállítási Útmutató

**Projekt:** FC Barcelona Szurkolói Portál  
**Production URL:** https://szakdolgozatfcb.vercel.app  
**Supabase projekt:** https://iflftoukxmesdbcohcub.supabase.co

---

## Áttekintés

A Google bejelentkezéshez két külső rendszert kell konfigurálni:

1. **Google Cloud Console** — OAuth alkalmazás létrehozása (Client ID + Secret)
2. **Supabase Dashboard** — Google provider bekapcsolása, URL-ek whitelist-elése

A folyamat sorrendje: Google Cloud Console → Supabase Dashboard. A Google-ben kapott adatokat a Supabase-be kell beilleszteni.

---

## 1. lépés — Google Cloud Console

### 1.1 Projekt megnyitása / létrehozása

1. Nyisd meg: https://console.cloud.google.com
2. Bal felső sarokban kattints a projekt választóra
3. Ha van már projekted (pl. a szakdolgozathoz), válaszd azt — ha nincs, kattints **New Project**-re, adj nevet (pl. `szakdolgozat-fcb`), majd **Create**

### 1.2 OAuth Consent Screen beállítása

> Ez szükséges mielőtt OAuth Client ID-t hoznál létre.

1. Bal menü: **APIs & Services → OAuth consent screen**
2. User Type: válaszd az **External** opciót → **Create**
3. Töltsd ki a kötelező mezőket:
   - **App name:** `FC Barcelona Szurkolói Portál`
   - **User support email:** a saját Gmail-ed
   - **Developer contact information:** a saját Gmail-ed
4. Kattints **Save and Continue**
5. **Scopes** lépésnél nem kell semmit hozzáadni → **Save and Continue**
6. **Test users** lépésnél add hozzá a saját Gmail-edet (fejlesztés közben csak ezek a fiókok tudnak belépni) → **Save and Continue**
7. **Summary** → **Back to Dashboard**

> **Megjegyzés:** Amíg az app "Testing" státuszban van, csak a Test Users listán szereplő Gmail fiókok tudnak belépni Google-lel. Ha élesbe szeretnéd állítani, a **Publishing status** melletti **Publish App** gombra kell kattintani — de szakdolgozatnál a Testing státusz elegendő.

### 1.3 OAuth Client ID létrehozása

1. Bal menü: **APIs & Services → Credentials**
2. Kattints **+ Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `szakdolgozat-fcb-web` (bármi)
5. **Authorized JavaScript origins** — add hozzá mindkettőt:
   ```
   http://localhost:3000
   https://szakdolgozatfcb.vercel.app
   ```
6. **Authorized redirect URIs** — **FONTOS:** ide a Supabase URL-je kerül, NEM a Vercel URL:
   ```
   https://iflftoukxmesdbcohcub.supabase.co/auth/v1/callback
   ```
7. Kattints **Create**

### 1.4 Adatok mentése

A létrehozás után egy popup jelenik meg:
- **Client ID** — valami ilyesmi: `123456789-abcdef.apps.googleusercontent.com`
- **Client Secret** — valami ilyesmi: `GOCSPX-...`

**Mentsd el ezeket**, a Supabase-be kell majd beilleszteni. Az ablak bezárása után a **Client Secret** nem jelenik meg újra (de bármikor regenerálható).

---

## 2. lépés — Supabase Dashboard

### 2.1 Google Provider bekapcsolása

1. Nyisd meg: https://supabase.com/dashboard/project/iflftoukxmesdbcohcub
2. Bal menü: **Authentication → Providers**
3. Keresd meg a **Google** sort, kattints rá
4. Kapcsold be: **Enable Sign in with Google** → **ON**
5. Illeszd be:
   - **Client ID (for OAuth):** a Google Cloud Console-ból kimásolt Client ID
   - **Client Secret:** a Google Cloud Console-ból kimásolt Client Secret
6. A **Callback URL (for OAuth)** mezőben látod a helyes értéket — ez automatikusan ki van töltve:
   ```
   https://iflftoukxmesdbcohcub.supabase.co/auth/v1/callback
   ```
   Ezt másoltad be a Google Cloud Console-ba az előző lépésben.
7. Kattints **Save**

### 2.2 Site URL és Redirect URLs beállítása

1. Bal menü: **Authentication → URL Configuration**
2. **Site URL** mező:
   ```
   https://szakdolgozatfcb.vercel.app
   ```
3. **Redirect URLs** mezőbe add hozzá az összes engedélyezett callback URL-t (soronként egyet):
   ```
   http://localhost:3000/auth/callback
   https://szakdolgozatfcb.vercel.app/auth/callback
   ```
4. Kattints **Save**

> **Miért kell ez?** A Supabase csak whitelistelt URL-ekre irányíthatja vissza a felhasználót az OAuth után. Ha hiányzik valamelyik, a bejelentkezés `redirect_uri_mismatch` hibával meghiúsul.

---

## 3. lépés — Vercel környezeti változók ellenőrzése

A `.env.local`-ban lévő értékeket a Vercel-ben is be kell állítani, hogy a production build is működjön.

1. Nyisd meg: https://vercel.com → a projekt → **Settings → Environment Variables**
2. Ellenőrizd, hogy mindhárom változó megvan **Production** és **Preview** környezetekre:

| Változó neve | Érték |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://iflftoukxmesdbcohcub.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (a `.env.local`-ból) |
| `SUPABASE_SERVICE_ROLE_KEY` | (a `.env.local`-ból) |

> A `SUPABASE_SERVICE_ROLE_KEY` különösen fontos — a Google callback account-merging logika ezt használja. Ha ez hiányzik a Vercel-ből, production-ben nem fog működni a duplikált email-védelem.

3. Ha hozzáadtál vagy módosítottál változót, a Vercel automatikusan újra build-eli a projektet (vagy manuálisan: **Deployments → Redeploy**)

---

## 4. lépés — Tesztelés

### Lokális tesztelés

```bash
npm run dev
```

1. Nyisd meg: http://localhost:3000/login
2. Kattints a **Belépés Google-lel** gombra
3. A Google consent screen-en válaszd ki a fiókod (csak a Test Users listán lévő fiók működik)
4. Sikeres bejelentkezés után az `/dashboard`-ra (vagy a `?returnUrl=` paraméterben megadott oldalra) irányít

### Account conflict tesztelése

1. Regisztrálj email+jelszóval: pl. `tesztfiok@gmail.com`
2. Logout
3. Próbálj belépni Google-lel ugyanazzal az email-lel (`tesztfiok@gmail.com`)
4. Elvárt eredmény: visszairányít a login oldalra, és megjelenik az üzenet: *"Ezzel az email címmel már regisztráltál jelszóval. Jelentkezz be jelszóval..."*
5. Az email mező automatikusan ki van töltve

---

## Hibakeresés

| Hiba | Ok | Megoldás |
|---|---|---|
| `redirect_uri_mismatch` | A Google-ben megadott redirect URI nem egyezik | Ellenőrizd a Google Cloud Console → Authorized redirect URIs mezőt — pontosan `https://iflftoukxmesdbcohcub.supabase.co/auth/v1/callback` kell |
| `Access blocked: This app's request is invalid` | OAuth consent screen nincs konfigurálva | Menj vissza a 1.2 lépésre |
| Google gomb megnyomása után semmi nem történik | Site URL vagy Redirect URL hiányzik a Supabase-ből | Ellenőrizd a 2.2 lépést |
| Belépés csak neked működik, másoknak nem | Az app "Testing" státuszban van, más email nincs a Test Users listán | Add hozzá a tesztelő Gmail fiókját a Test Users-hez, vagy publikáld az appot |
| Production-ben `500` hiba a callback-nél | `SUPABASE_SERVICE_ROLE_KEY` hiányzik a Vercel env-ből | Ellenőrizd a 3. lépést |
