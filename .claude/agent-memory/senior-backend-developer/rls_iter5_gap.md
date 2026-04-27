---
name: Iter5 webshop tables had RLS-on but no policies until 012
description: Historical gap; orders/cart/wishlist/reviews/order_items shipped without policies through iter5–11
type: project
---

The webshop tables (`cart_items`, `wishlist`, `reviews`, `orders`, `order_items`) had RLS enabled by 002_schema.sql but no policies defined until migration 012. Until 012 ran, anything that hit those tables via the cookie-bound `createClient()` got nothing back (RLS-enabled with no policy = deny-all).

**Why:** 004_rls_policies.sql only covered the iter1/2 tables; 005–011 only added policies tied to their feature work. The iter5 (webshop) iteration shipped purely on top of `createServiceRoleClient()` for writes plus reads from RLS-on but policy-less tables that happened to work for the original developer because the service role bypasses RLS.

**How to apply:** Before claiming an iteration's RLS is done, query `pg_policies` (or call `audit_rls_coverage()` from 012) to confirm no rls-enabled tables are policy-less. The `cart` and `wishlist` GET routes use the auth-bound client; without policies they would return empty arrays silently.
