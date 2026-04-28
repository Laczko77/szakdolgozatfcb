---
name: API response envelope inconsistency
description: Some API routes wrap in { data } via successResponse(); others (matches/[id], tickets GET) return raw shape — clients must match
type: project
---

Two coexisting JSON envelopes in src/app/api/**:

1. **Wrapped** — `successResponse(payload, status)` from `lib/api-utils.ts`
   yields `{ data: payload }`. Used by most write endpoints, including
   `POST /api/tickets/purchase`.
2. **Raw** — handlers that call `NextResponse.json(payload)` directly.
   Used by `GET /api/matches/[id]`, `GET /api/tickets`, several others.

**Why:** Historical drift — early endpoints were raw, the envelope was
introduced later, and the legacy ones never got migrated.

**How to apply:** Before writing a fetch wrapper, open the route handler
and check whether it goes through `successResponse()`. The admin panel
uses `adminFetch` (auto-unwraps `.data`) vs `adminFetchRaw` (returns
raw body) for exactly this reason. Public-side fetchers in
`lib/*-api.ts` should mirror this — F18.2 was a bug where
`purchaseTickets()` read the body raw but the route used the wrapped
envelope, yielding `tickets = undefined` and a TypeError on `.length`.

When in doubt, prefer the wrapped envelope on new code AND unwrap
defensively on the client (`raw?.data ?? raw`) so existing callers
keep working through migrations.
