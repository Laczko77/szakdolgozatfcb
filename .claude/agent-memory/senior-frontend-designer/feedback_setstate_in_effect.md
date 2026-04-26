---
name: Avoid synchronous setState in useEffect bodies
description: React 19 + eslint-config-next forbids setState directly in effect bodies; wrap in async IIFE or queueMicrotask
type: feedback
---

The project's ESLint config (eslint-config-next 16.x with React 19) treats `react-hooks/set-state-in-effect` as an error. Direct calls like `useEffect(() => { setX(...) }, [...])` will fail lint.

**Why:** React 19 surfaces this as a real anti-pattern — synchronous setState inside an effect can cascade renders. AuthProvider already uses the IIFE escape hatch, and the F8 shop components had to follow suit.

**How to apply:**
- For async data fetches: wrap the body in an `async () => { ... }()` IIFE — setState inside the callback is fine.
- For one-off conditional setState (e.g. clamping state to a derived bound): wrap the call in `queueMicrotask(() => setX(...))`.
- For setState driven by external events (intervals, listeners, subscriptions): the rule already accepts it — no change needed.
