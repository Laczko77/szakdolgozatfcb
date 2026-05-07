import { describe, it, expect } from 'vitest';
import {
  FORMATIONS,
  DREAM_TEAM_FORMATIONS,
  FORMATION_LABELS,
  SLOT_ROLE_LABELS,
  slotAcceptsPosition,
  describeSlotAccept,
} from '@/lib/dream-team-formations';
import type { FormationSlot } from '@/lib/dream-team-formations';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EXPECTED_FORMATIONS = ['4-3-3', '4-2-3-1', '3-5-2', '4-4-2'] as const;

// ---------------------------------------------------------------------------
// FORMATIONS — structural integrity
// ---------------------------------------------------------------------------

describe('FORMATIONS', () => {
  it('contains exactly 4 formations', () => {
    expect(Object.keys(FORMATIONS)).toHaveLength(4);
  });

  it('contains all expected formation keys', () => {
    for (const key of EXPECTED_FORMATIONS) {
      expect(FORMATIONS).toHaveProperty(key);
    }
  });

  describe.each(EXPECTED_FORMATIONS)('formation "%s"', (formation) => {
    const slots = FORMATIONS[formation];

    it('has exactly 11 slots', () => {
      expect(slots).toHaveLength(11);
    });

    it('slotIndex matches array index for every slot', () => {
      slots.forEach((slot, index) => {
        expect(slot.slotIndex).toBe(index);
      });
    });

    it('has exactly 1 GK slot', () => {
      const gkSlots = slots.filter((s) => s.role === 'GK');
      expect(gkSlots).toHaveLength(1);
    });

    it('has GK slot at slotIndex 0', () => {
      expect(slots[0].role).toBe('GK');
    });

    it('all x coordinates are between 0 and 100 inclusive', () => {
      for (const slot of slots) {
        expect(slot.x).toBeGreaterThanOrEqual(0);
        expect(slot.x).toBeLessThanOrEqual(100);
      }
    });

    it('all y coordinates are between 0 and 100 inclusive', () => {
      for (const slot of slots) {
        expect(slot.y).toBeGreaterThanOrEqual(0);
        expect(slot.y).toBeLessThanOrEqual(100);
      }
    });

    it('every slot has a non-empty accepts array', () => {
      for (const slot of slots) {
        expect(slot.accepts.length).toBeGreaterThan(0);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// DREAM_TEAM_FORMATIONS — array completeness
// ---------------------------------------------------------------------------

describe('DREAM_TEAM_FORMATIONS', () => {
  it('contains exactly 4 entries', () => {
    expect(DREAM_TEAM_FORMATIONS).toHaveLength(4);
  });

  it('contains "4-3-3"', () => {
    expect(DREAM_TEAM_FORMATIONS).toContain('4-3-3');
  });

  it('contains "4-2-3-1"', () => {
    expect(DREAM_TEAM_FORMATIONS).toContain('4-2-3-1');
  });

  it('contains "3-5-2"', () => {
    expect(DREAM_TEAM_FORMATIONS).toContain('3-5-2');
  });

  it('contains "4-4-2"', () => {
    expect(DREAM_TEAM_FORMATIONS).toContain('4-4-2');
  });
});

// ---------------------------------------------------------------------------
// FORMATION_LABELS
// ---------------------------------------------------------------------------

describe('FORMATION_LABELS', () => {
  it('has a label for every DREAM_TEAM_FORMATIONS entry', () => {
    for (const formation of DREAM_TEAM_FORMATIONS) {
      expect(FORMATION_LABELS[formation]).toBeDefined();
      expect(typeof FORMATION_LABELS[formation]).toBe('string');
    }
  });
});

// ---------------------------------------------------------------------------
// SLOT_ROLE_LABELS
// ---------------------------------------------------------------------------

describe('SLOT_ROLE_LABELS', () => {
  it('GK maps to "Kapus"', () => {
    expect(SLOT_ROLE_LABELS['GK']).toBe('Kapus');
  });

  it('DEF maps to "Védő"', () => {
    expect(SLOT_ROLE_LABELS['DEF']).toBe('Védő');
  });

  it('MID maps to "Középpályás"', () => {
    expect(SLOT_ROLE_LABELS['MID']).toBe('Középpályás');
  });

  it('ATT maps to "Támadó"', () => {
    expect(SLOT_ROLE_LABELS['ATT']).toBe('Támadó');
  });

  it('ST maps to "Csatár"', () => {
    expect(SLOT_ROLE_LABELS['ST']).toBe('Csatár');
  });
});

// ---------------------------------------------------------------------------
// slotAcceptsPosition
// ---------------------------------------------------------------------------

describe('slotAcceptsPosition', () => {
  // A slot paraméter ignorált — bármilyen FormationSlot-ot használhatunk
  const anySlot = FORMATIONS['4-3-3'][0];

  it('returns true for "Goalkeeper"', () => {
    expect(slotAcceptsPosition(anySlot, 'Goalkeeper')).toBe(true);
  });

  it('returns true for "Defender"', () => {
    expect(slotAcceptsPosition(anySlot, 'Defender')).toBe(true);
  });

  it('returns true for "Midfielder"', () => {
    expect(slotAcceptsPosition(anySlot, 'Midfielder')).toBe(true);
  });

  it('returns true for "Attacker"', () => {
    expect(slotAcceptsPosition(anySlot, 'Attacker')).toBe(true);
  });

  it('returns true for an arbitrary truthy string ("UnknownPosition")', () => {
    expect(slotAcceptsPosition(anySlot, 'UnknownPosition')).toBe(true);
  });

  it('returns false for null', () => {
    expect(slotAcceptsPosition(anySlot, null)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(slotAcceptsPosition(anySlot, '')).toBe(false);
  });

  it('slot parameter is ignored — different slots yield same result for same position', () => {
    const gkSlot = FORMATIONS['4-3-3'][0];   // role: GK
    const attSlot = FORMATIONS['4-3-3'][8];   // role: ATT
    expect(slotAcceptsPosition(gkSlot, 'Attacker')).toBe(
      slotAcceptsPosition(attSlot, 'Attacker'),
    );
    expect(slotAcceptsPosition(gkSlot, null)).toBe(
      slotAcceptsPosition(attSlot, null),
    );
  });
});

// ---------------------------------------------------------------------------
// describeSlotAccept
// ---------------------------------------------------------------------------

describe('describeSlotAccept', () => {
  const makeSlot = (accepts: FormationSlot['accepts']): FormationSlot => ({
    slotIndex: 0,
    role: 'GK',
    x: 50,
    y: 90,
    accepts,
  });

  it('GK slot (accepts: ["Goalkeeper"]) → "kapus"', () => {
    const slot = makeSlot(['Goalkeeper']);
    expect(describeSlotAccept(slot)).toBe('kapus');
  });

  it('DEF slot (accepts: ["Defender"]) → "védő"', () => {
    const slot = makeSlot(['Defender']);
    expect(describeSlotAccept(slot)).toBe('védő');
  });

  it('MID slot (accepts: ["Midfielder"]) → "középpályás"', () => {
    const slot = makeSlot(['Midfielder']);
    expect(describeSlotAccept(slot)).toBe('középpályás');
  });

  it('ATT slot (accepts: ["Attacker"]) → "támadó"', () => {
    const slot = makeSlot(['Attacker']);
    expect(describeSlotAccept(slot)).toBe('támadó');
  });

  it('multi-accept slot joins labels with " / "', () => {
    const slot = makeSlot(['Midfielder', 'Attacker']);
    expect(describeSlotAccept(slot)).toBe('középpályás / támadó');
  });

  it('multi-accept with three values joins all three with " / "', () => {
    const slot = makeSlot(['Goalkeeper', 'Defender', 'Midfielder']);
    expect(describeSlotAccept(slot)).toBe('kapus / védő / középpályás');
  });

  it('uses the actual GK slot from FORMATIONS["4-3-3"] → "kapus"', () => {
    const gkSlot = FORMATIONS['4-3-3'][0];
    expect(describeSlotAccept(gkSlot)).toBe('kapus');
  });

  it('uses an actual DEF slot from FORMATIONS["4-4-2"] → "védő"', () => {
    const defSlot = FORMATIONS['4-4-2'][1];
    expect(describeSlotAccept(defSlot)).toBe('védő');
  });

  it('uses an actual MID slot from FORMATIONS["3-5-2"] → "középpályás"', () => {
    const midSlot = FORMATIONS['3-5-2'][4];
    expect(describeSlotAccept(midSlot)).toBe('középpályás');
  });

  it('uses an actual ATT slot from FORMATIONS["4-3-3"] → "támadó"', () => {
    const attSlot = FORMATIONS['4-3-3'][8];
    expect(describeSlotAccept(attSlot)).toBe('támadó');
  });

  it('uses the ST slot from FORMATIONS["4-2-3-1"] → "támadó" (Attacker label)', () => {
    // slotIndex 10, role ST, accepts ALL_FORWARDS = ["Attacker"]
    const stSlot = FORMATIONS['4-2-3-1'][10];
    expect(describeSlotAccept(stSlot)).toBe('támadó');
  });
});
