/**
 * Hungarian labels for the four canonical player positions.
 *
 * The backend stores positions as the API-Football English strings
 * ("Goalkeeper", "Defender", "Midfielder", "Attacker") so they stay
 * stable across syncs. The frontend translates at display time.
 *
 * Two label maps are exported:
 *   - `PLAYER_POSITION_LABELS`        → singular ("Kapus", "Védő", …)
 *   - `PLAYER_POSITION_LABELS_PLURAL` → plural / section header ("Kapusok", …)
 */

import type { PlayerPosition } from "@/lib/constants";

export const PLAYER_POSITION_LABELS: Record<PlayerPosition, string> = {
  Goalkeeper: "Kapus",
  Defender: "Védő",
  Midfielder: "Középpályás",
  Attacker: "Támadó",
};

export const PLAYER_POSITION_LABELS_PLURAL: Record<PlayerPosition, string> = {
  Goalkeeper: "Kapusok",
  Defender: "Védők",
  Midfielder: "Középpályások",
  Attacker: "Támadók",
};

/**
 * Short two-letter abbreviations used in the badge corner of player cards.
 * Helps when the card width is constrained at the 2-col mobile breakpoint.
 */
export const PLAYER_POSITION_SHORT: Record<PlayerPosition, string> = {
  Goalkeeper: "GK",
  Defender: "DF",
  Midfielder: "MP",
  Attacker: "TM",
};
