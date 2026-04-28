import { NextResponse } from 'next/server'

/**
 * POST /api/admin/matches/[id]/sectors
 *
 * Disabled as of Iteration 16. The four fixed sectors (TRIBUNA, LATERAL,
 * GOL NORD, GOL SUD) are auto-seeded for every match by the match sync
 * endpoint and cannot be manually created. The admin can still edit
 * `total_seats` and `price` per sector via PUT
 * /api/admin/matches/[id]/sectors/[sectorId].
 *
 * If a match is missing its sectors for any reason, use
 * POST /api/admin/matches/[id]/seed-sectors to (idempotently) create them.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        'A szektorok automatikusan jönnek létre meccs szinkronizáláskor. Manuális létrehozás nem engedélyezett.',
    },
    {
      status: 405,
      headers: { Allow: 'PUT' },
    }
  )
}
