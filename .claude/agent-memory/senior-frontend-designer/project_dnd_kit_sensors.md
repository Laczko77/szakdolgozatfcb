---
name: dnd-kit sensor split for dream-team (F27.5)
description: /jatekosok/almomcsapat uses MouseSensor + TouchSensor (delay-activated), not the unified PointerSensor
type: project
---

The dream-team builder (`/jatekosok/almomcsapat`) registers two separate dnd-kit sensors instead of the single `PointerSensor`:

```ts
useSensors(
  useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
);
```

**Why:** F27.5 reverted from `PointerSensor` after touch regressions:
- iOS Safari occasionally fired drag immediately on a tap, which prevented vertical scrolling above the pitch.
- Android Chrome's 5px distance threshold mis-classified scroll-intent as drag-intent when the finger drifted.

The `delay: 150ms` on TouchSensor is the canonical dnd-kit recipe for tap-vs-drag disambiguation on mobile. MouseSensor stays at distance-only (long-press would feel sluggish on desktop).

**How to apply:** Other future drag/drop surfaces should follow the same MouseSensor + TouchSensor split if they need to coexist with vertical scroll on mobile. Pure-desktop drag interactions can keep PointerSensor.

Slot-to-slot swap semantics also live here: `placePlayerOnSlot()` now reads the source slot of the dragged player and tries to keep the displaced player on the source slot if positions are compatible. Otherwise the displaced player falls back to the pool (the historical behaviour). Either way, no player vanishes silently.
