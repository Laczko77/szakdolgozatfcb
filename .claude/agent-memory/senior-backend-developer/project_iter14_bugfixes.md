---
name: Iter14 backend bugfix root causes
description: Why the three iter14 bugs occurred and the contract decisions made fixing them — relevant if these areas regress later.
type: project
---

Iter14 (2026-04-28) shipped fixes for three production-test bugs.

**Why:** These root causes are surprising and not obvious from the diff alone — knowing them prevents re-introducing the same bugs in adjacent code.

**How to apply:** When touching player sync, product list, or coupon redeem, recall these constraints before changing the contracts.

1. **Player stats 0-0-0 is mostly NOT a bug.** football-data.org `/competitions/{id}/scorers` returns only the top-100 ranked players per competition. Bench/unused FCB squad members legitimately fall through with all-zero stats. The squad-id ↔ scorer.player.id mapping is correct (same numeric id from both endpoints). Don't "fix" this by switching to name-based matching — IDs are authoritative.

2. **Products list never aggregated reviews.** The original `/api/products` did a `select('*')` on `products` only. The fix performs a single batched `reviews` query for the current page's product ids and groups in JS. Each product is enriched with `average_rating` (number | null) and `review_count` (number). `null` (not 0) when no visible reviews exist — the frontend distinguishes "no rating yet" from "rated 0".

3. **Coupon redeem 500s came from blanket P0001 → 409 mapping.** The original handler treated every business-rule violation as 409 Conflict. Migration 010's `redeem_coupon` RPC raises distinct P0001 messages — they are now mapped to 400/404/409/503 via Hungarian-message substring matching. The DB-side strings are stable contract; if migration 010 messages change, update `mapBusinessRuleError()` in `src/app/api/shop/coupons/[id]/redeem/route.ts`.

No migration changes were needed for iter14 — the existing 010 RPC was correct, only the API layer error mapping was wrong.
