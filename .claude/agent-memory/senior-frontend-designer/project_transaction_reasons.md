---
name: Point transaction reasons translated via lib/i18n
description: point_transactions.reason stores English machine ids (poll_win, coupon_redeem); UI must run them through formatPointReason
type: project
---

The `point_transactions.reason` column stores stable machine
identifiers (`poll_win`, `coupon_redeem`, `registration_bonus`,
`purchase`, `admin_grant`) — set by SQL triggers/RPCs in migrations
009 and 010. The portal speaks Hungarian, so any UI rendering of
`tx.reason` must translate first.

**Helper:** `formatPointReason(reason)` in
`src/lib/i18n/transaction-reasons.ts`. Map-based with a Title-cased
fallback for unknown reasons (so new SQL reasons never leak the raw
`snake_case` to users).

**Call sites today:**
- `src/components/polls/PointsTransactionList.tsx` — full history list.
- `src/components/dashboard/PointsWidget.tsx` — last-transaction card.

**Important nuance for icons:** The `TransactionIcon` resolver in
`PointsTransactionList` sniffs the **raw** English reason
(`key.includes("poll")`, `"coupon"`, `"bonus"`) — NOT the translated
label — so the icon mapping stays stable as the translation map evolves.
Adding a new reason requires updating the map AND, if it deserves a
custom icon, the icon switch.
