/**
 * Fixed sector domain for the FC Barcelona fan portal ticketing system.
 *
 * The frontend renders an SVG stadium map with these four hard-coded zones,
 * so every match must have exactly these sectors and no others. The
 * `match_sectors_sector_name_check` CHECK constraint in the database
 * enforces the same domain (see migration 013).
 *
 * Default capacities and prices (HUF) are seed values only — admins may
 * later edit `total_seats` and `price` per match via the sector PUT endpoint.
 * Re-running the match sync will NOT overwrite those edits (the seed uses
 * INSERT ... ON CONFLICT DO NOTHING).
 */

export const FIXED_SECTORS = [
  { name: 'TRIBUNA', defaultSeats: 500, defaultPrice: 25000 },
  { name: 'LATERAL', defaultSeats: 800, defaultPrice: 18000 },
  { name: 'GOL NORD', defaultSeats: 400, defaultPrice: 12000 },
  { name: 'GOL SUD', defaultSeats: 400, defaultPrice: 12000 },
] as const

export type SectorName = (typeof FIXED_SECTORS)[number]['name']

export const FIXED_SECTOR_NAMES: readonly SectorName[] = FIXED_SECTORS.map(
  (s) => s.name
) as readonly SectorName[]

export function isFixedSectorName(value: unknown): value is SectorName {
  return (
    typeof value === 'string' &&
    (FIXED_SECTOR_NAMES as readonly string[]).includes(value)
  )
}
