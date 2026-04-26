---
name: RPC for atomic mutations
description: Backlog explicitly mandates Supabase RPCs (PL/pgSQL) for race-prone multi-step mutations; the orders endpoint uses a different (best-effort rollback) pattern.
type: project
---

The backlog (Iteration 13 risks section, line 459) explicitly calls out that race-condition-prone purchases must use a Supabase RPC for transactional handling — concretely listing "two users buying the last ticket" as the motivating scenario.

**Why:** The existing `POST /api/orders` route uses a different pattern (sequential SDK calls + manual rollback by re-inserting/restoring stock). That pattern is OK for cart checkout because the unique-constraint surface is narrow (variant stock counter is single-row, decrement-then-rollback works). For ticketing, capacity AND seat-number uniqueness AND a per-user cap have to be evaluated together — the only sane way is a single transaction with `pg_advisory_xact_lock` keyed on the resource id (`sector_id` for tickets).

**How to apply:** When implementing future iterations that involve atomic counter updates against a shared resource — Iteration 9 (poll resolve: bump every winner's `user_points.balance`), Iteration 10 (coupon redemption: deduct points + insert redeemed coupon + flip `is_used`) — prefer a `SECURITY DEFINER` PL/pgSQL function with explicit SQLSTATE `P0001` for business-rule violations, mapped to HTTP 409 in the route. The route stays thin: validate inputs, call `supabase.rpc()`, map the SQLSTATE.

The migration `006_tickets_rls_and_rpc.sql` is the reference implementation: advisory lock + row lock + capacity check + cap check + insert + counter update, all in one function.
