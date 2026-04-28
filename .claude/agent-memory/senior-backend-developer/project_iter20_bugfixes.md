---
name: Iter20 backend bugfix root causes
description: Root causes for the four iteration 20 bugfixes — UUID 22P02, pgcrypto missing, scorers top-100 limit, admin matches envelope mismatch
type: project
---

Iteration 20 (Bug Fix) shipped four backend fixes. Root causes worth remembering:

1. **GET /api/articles/[id] crashed on non-UUID IDs.** Postgres throws SQLSTATE `22P02` (invalid_text_representation) on a `uuid` column when given e.g. `"foo"`; Supabase surfaces it untyped → unhandled 500. Fixed with regex pre-validation + post-error 22P02 → 404 mapping.

2. **`redeem_coupon` RPC failed with `gen_random_bytes(integer) does not exist`.** The `pgcrypto` extension is NOT enabled by default on Supabase projects. Switched the code generator to `gen_random_uuid()` (built-in to PG13+; always available) — same `BARCA-XXXX-XXXX` shape, hex alphabet instead of [A-Z0-9].

3. **`players.stats` shows 0-0-0-0 for most squad members.** This is NOT a mapping bug — the football-data.org `/competitions/{id}/scorers` endpoint only returns the top-100 scoring players per competition, so bench/unused FCB players legitimately fall through with zeros. The squad-id ↔ scorer-id join is correct (both come from football-data.org's same player ID space). Added per-player info log to make this visible to admins.

4. **Admin szavazasok dropdown showed "Nincs meccs" despite upcoming matches.** Cause: `adminFetch<Match[]>` unwraps `json.data` (the standard admin envelope), but `/api/matches` returns `{ matches: [...] }` — not the `{ data }` shape. So `json.data` is undefined → empty list. Use `adminFetchRaw<{ matches: Match[] }>` for any public endpoint called from the admin panel.

**Why:** all four are subtle integration bugs that are hard to find by reading either side alone — they only surface where two layers meet.

**How to apply:**
- Any route that takes `[id]` of a `uuid` column must pre-validate the UUID format AND map 22P02 to 404.
- Never assume Supabase has pgcrypto — prefer `gen_random_uuid()` for any random-token need in SQL.
- When wiring an admin page to a *public* (non-admin) API endpoint, use `adminFetchRaw` with the endpoint's actual top-level shape; `adminFetch` only works for routes that use `successResponse(...)`.
