---
name: Iter14 backend bugfix root causes
description: Why the iter14 bugs occurred + later finding (2026-04-28) that pgcrypto search_path breaks coupon redeem in production.
type: project
---

Iter14 (2026-04-28) shipped fixes for three production-test bugs.

**Why:** These root causes are surprising and not obvious from the diff alone — knowing them prevents re-introducing the same bugs in adjacent code.

**How to apply:** When touching player sync, product list, or coupon redeem, recall these constraints before changing the contracts.

1. **Player stats 0-0-0 is mostly NOT a bug, but the contract is incomplete.** football-data.org `/competitions/{id}/scorers` returns only the top-100 ranked players per competition. Bench/unused FCB squad members AND most defenders/keepers legitimately fall through with all-zero stats — they are not in the top-100 scorer list. The squad-id ↔ scorer.player.id mapping is correct (same numeric id from both endpoints). Don't "fix" this by switching to name-based matching — IDs are authoritative. **To get real stats for non-top-100 players** you have to integrate `/teams/{id}/matches?status=FINISHED&season=...` or `/persons/{playerId}/matches` and aggregate per-match. Alex Baldé and ~13 other FCB players hit this.

2. **Products list never aggregated reviews.** The original `/api/products` did a `select('*')` on `products` only. The fix performs a single batched `reviews` query for the current page's product ids and groups in JS. Each product is enriched with `average_rating` (number | null) and `review_count` (number). `null` (not 0) when no visible reviews exist — the frontend distinguishes "no rating yet" from "rated 0".

3. **Coupon redeem 500s came from blanket P0001 → 409 mapping.** The original handler treated every business-rule violation as 409 Conflict. Migration 010's `redeem_coupon` RPC raises distinct P0001 messages — they are now mapped to 400/404/409/503 via Hungarian-message substring matching. The DB-side strings are stable contract; if migration 010 messages change, update `mapBusinessRuleError()` in `src/app/api/shop/coupons/[id]/redeem/route.ts`.

4. **`gen_random_bytes` not found — pgcrypto search_path trap.** Migration 010 `_generate_coupon_code()` declares `SET search_path = public`, but on Supabase managed projects the `pgcrypto` extension lives in the `extensions` schema, not `public`. The 002 `CREATE EXTENSION pgcrypto` only succeeds locally; on Supabase prod the extension is pre-installed in `extensions`. Fix: either change `search_path = public, extensions` or fully-qualify as `extensions.gen_random_bytes(8)`. Same trap will hit any other SECURITY DEFINER function that uses pgcrypto with a locked-down search_path.

No migration changes were needed for items 1-3 in iter14 — the existing 010 RPC was correct, only the API layer error mapping was wrong. Item 4 needs a new migration.
