---
name: profiles RLS only allows own/admin SELECT — use service-role for cross-user lookups
description: Cross-user profile reads silently return null under the cookie client; use service-role and only project public columns
type: project
---

A `public.profiles` tábla SELECT RLS policy-ja (`profiles_select_own_or_admin` a 004_rls_policies.sql-ben):
`USING (auth.uid() = id OR public.is_admin())`. Ez azt jelenti hogy egy normál user a cookie-alapú kliensen át **csak a saját profilját** látja — minden más profil-lekérdezés `null`-t ad vissza error nélkül.

**Why:** Ezt nem az RLS hibájaként, hanem szivárgás-védelemként hagyták így (email, address mezők a `Profile` interface-ben). Az iter21 backend bug az volt, hogy follow + DM + posts feed mind erre a query-re támaszkodott — minden hibát "user not found" 404-ként láttunk.

**How to apply:** Ha egy API route-nak más user nyilvános mezőit (`id, username, avatar_url`) kell olvasni, használj `createServiceRoleClient()`-et és csak a publikus mezőket szelektáld a JSON válaszba. NE adj vissza `email`-t vagy `address`-t más userről service-role bypass-olt query-ből. A `follows` SELECT policy ezzel szemben public, így a cookie-kliens elég ott.

Minták:
- `src/app/api/posts/route.ts` `fetchAuthors`
- `src/app/api/conversations/route.ts` `fetchProfilesByIds`
- `src/app/api/users/[id]/follow/route.ts` target ellenőrzés
