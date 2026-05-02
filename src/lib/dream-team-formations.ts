/**
 * Static slot definitions for the Dream Team page.
 *
 * Each formation maps to an ordered list of 11 slots. The order is the
 * canonical `slotIndex` 0..10 used in the API payload — never reshuffle
 * existing slot indexes when editing this file or saved teams break.
 *
 * Coordinates are percentages on the SVG viewBox where:
 *   - x = 0%  → left touchline
 *   - x = 100% → right touchline
 *   - y = 0%  → opposing goal line (top of the pitch)
 *   - y = 100% → own goal line (bottom of the pitch)
 *
 * `accepts` declares which canonical {@link PlayerPosition} values can be
 * dropped on a given slot. The "ST" slot in 4-2-3-1 is treated as an
 * "Attacker" slot — football-data.org doesn't distinguish ST vs CF.
 */

import type { PlayerPosition } from "@/lib/constants";
import type { DreamTeamFormation } from "@/types/database";

export type SlotRole = "GK" | "DEF" | "MID" | "ATT" | "ST";

export interface FormationSlot {
  /** Stable index 0..10 — persisted to the DB, do not renumber. */
  slotIndex: number;
  /** Human-facing role tag (also used as the persisted `position` string). */
  role: SlotRole;
  /** SVG viewBox percentage coordinate, 0..100. */
  x: number;
  y: number;
  /** Canonical PlayerPosition values accepted by this slot. */
  accepts: ReadonlyArray<PlayerPosition>;
}

const ALL_FORWARDS: ReadonlyArray<PlayerPosition> = ["Attacker"];
const ALL_MIDS: ReadonlyArray<PlayerPosition> = ["Midfielder"];
const ALL_DEFS: ReadonlyArray<PlayerPosition> = ["Defender"];
const ALL_GKS: ReadonlyArray<PlayerPosition> = ["Goalkeeper"];

/**
 * Each formation: exactly 11 slots, ordered such that slotIndex matches
 * the array position. The DB's check constraints don't depend on ordering,
 * but we keep it consistent so `players[i].slotIndex === i` holds.
 */
export const FORMATIONS: Record<DreamTeamFormation, ReadonlyArray<FormationSlot>> = {
  "4-3-3": [
    { slotIndex: 0, role: "GK", x: 50, y: 90, accepts: ALL_GKS },
    { slotIndex: 1, role: "DEF", x: 15, y: 70, accepts: ALL_DEFS },
    { slotIndex: 2, role: "DEF", x: 38, y: 70, accepts: ALL_DEFS },
    { slotIndex: 3, role: "DEF", x: 62, y: 70, accepts: ALL_DEFS },
    { slotIndex: 4, role: "DEF", x: 85, y: 70, accepts: ALL_DEFS },
    { slotIndex: 5, role: "MID", x: 25, y: 50, accepts: ALL_MIDS },
    { slotIndex: 6, role: "MID", x: 50, y: 50, accepts: ALL_MIDS },
    { slotIndex: 7, role: "MID", x: 75, y: 50, accepts: ALL_MIDS },
    { slotIndex: 8, role: "ATT", x: 20, y: 25, accepts: ALL_FORWARDS },
    { slotIndex: 9, role: "ATT", x: 50, y: 20, accepts: ALL_FORWARDS },
    { slotIndex: 10, role: "ATT", x: 80, y: 25, accepts: ALL_FORWARDS },
  ],
  "4-2-3-1": [
    { slotIndex: 0, role: "GK", x: 50, y: 90, accepts: ALL_GKS },
    { slotIndex: 1, role: "DEF", x: 15, y: 72, accepts: ALL_DEFS },
    { slotIndex: 2, role: "DEF", x: 38, y: 72, accepts: ALL_DEFS },
    { slotIndex: 3, role: "DEF", x: 62, y: 72, accepts: ALL_DEFS },
    { slotIndex: 4, role: "DEF", x: 85, y: 72, accepts: ALL_DEFS },
    { slotIndex: 5, role: "MID", x: 30, y: 58, accepts: ALL_MIDS },
    { slotIndex: 6, role: "MID", x: 70, y: 58, accepts: ALL_MIDS },
    { slotIndex: 7, role: "ATT", x: 20, y: 38, accepts: ALL_FORWARDS },
    { slotIndex: 8, role: "ATT", x: 50, y: 35, accepts: ALL_FORWARDS },
    { slotIndex: 9, role: "ATT", x: 80, y: 38, accepts: ALL_FORWARDS },
    { slotIndex: 10, role: "ST", x: 50, y: 18, accepts: ALL_FORWARDS },
  ],
  "3-5-2": [
    { slotIndex: 0, role: "GK", x: 50, y: 90, accepts: ALL_GKS },
    { slotIndex: 1, role: "DEF", x: 25, y: 72, accepts: ALL_DEFS },
    { slotIndex: 2, role: "DEF", x: 50, y: 72, accepts: ALL_DEFS },
    { slotIndex: 3, role: "DEF", x: 75, y: 72, accepts: ALL_DEFS },
    { slotIndex: 4, role: "MID", x: 12, y: 52, accepts: ALL_MIDS },
    { slotIndex: 5, role: "MID", x: 32, y: 52, accepts: ALL_MIDS },
    { slotIndex: 6, role: "MID", x: 50, y: 52, accepts: ALL_MIDS },
    { slotIndex: 7, role: "MID", x: 68, y: 52, accepts: ALL_MIDS },
    { slotIndex: 8, role: "MID", x: 88, y: 52, accepts: ALL_MIDS },
    { slotIndex: 9, role: "ATT", x: 35, y: 22, accepts: ALL_FORWARDS },
    { slotIndex: 10, role: "ATT", x: 65, y: 22, accepts: ALL_FORWARDS },
  ],
  "4-4-2": [
    { slotIndex: 0, role: "GK", x: 50, y: 90, accepts: ALL_GKS },
    { slotIndex: 1, role: "DEF", x: 15, y: 72, accepts: ALL_DEFS },
    { slotIndex: 2, role: "DEF", x: 38, y: 72, accepts: ALL_DEFS },
    { slotIndex: 3, role: "DEF", x: 62, y: 72, accepts: ALL_DEFS },
    { slotIndex: 4, role: "DEF", x: 85, y: 72, accepts: ALL_DEFS },
    { slotIndex: 5, role: "MID", x: 15, y: 52, accepts: ALL_MIDS },
    { slotIndex: 6, role: "MID", x: 38, y: 52, accepts: ALL_MIDS },
    { slotIndex: 7, role: "MID", x: 62, y: 52, accepts: ALL_MIDS },
    { slotIndex: 8, role: "MID", x: 85, y: 52, accepts: ALL_MIDS },
    { slotIndex: 9, role: "ATT", x: 35, y: 22, accepts: ALL_FORWARDS },
    { slotIndex: 10, role: "ATT", x: 65, y: 22, accepts: ALL_FORWARDS },
  ],
};

export const DREAM_TEAM_FORMATIONS: ReadonlyArray<DreamTeamFormation> = [
  "4-3-3",
  "4-2-3-1",
  "3-5-2",
  "4-4-2",
];

export const FORMATION_LABELS: Record<DreamTeamFormation, string> = {
  "4-3-3": "4-3-3",
  "4-2-3-1": "4-2-3-1",
  "3-5-2": "3-5-2",
  "4-4-2": "4-4-2",
};

export const SLOT_ROLE_LABELS: Record<SlotRole, string> = {
  GK: "Kapus",
  DEF: "Védő",
  MID: "Középpályás",
  ATT: "Támadó",
  ST: "Csatár",
};

/**
 * Returns true if a {@link Player} with the given DB position string can be
 * placed on this slot.
 *
 * F27.6 — the slot-role gating used to refuse "wrong position" drops (e.g.
 * defender on an ATT slot). UX feedback was that creative line-ups (false-9,
 * inverted full-backs, midfielder-as-striker) all hit a hard wall, so we
 * relaxed the rule: any positioned player can be placed on any slot. The
 * `slot.accepts` arrays are still used to *label* the role on the pitch, but
 * they no longer reject drops. We keep the second argument so existing call
 * sites (drag highlighting, formation-change carry-over, drop handler) stay
 * unchanged.
 */
export function slotAcceptsPosition(
  _slot: FormationSlot,
  position: string | null,
): boolean {
  // Reject only the truly-unknown case — a player record without a position
  // string is data-quality noise, not a UX choice.
  return Boolean(position);
}

/**
 * Used by the toast / aria-live region: "Erre a pozícióra csak X kerülhet!"
 */
export function describeSlotAccept(slot: FormationSlot): string {
  const labels = slot.accepts.map((p) => {
    switch (p) {
      case "Goalkeeper":
        return "kapus";
      case "Defender":
        return "védő";
      case "Midfielder":
        return "középpályás";
      case "Attacker":
        return "támadó";
    }
  });
  return labels.join(" / ");
}
