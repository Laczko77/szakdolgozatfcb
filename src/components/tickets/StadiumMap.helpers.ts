/**
 * Pure helpers for the {@link StadiumMap} component. Extracted so the
 * sector-mapping and ARIA-description logic can be unit-tested without
 * the React/framer-motion runtime.
 */

import { formatPrice } from "@/lib/format";
import type { SectorName } from "@/lib/constants/sectors";
import type { SectorWithAvailability } from "@/lib/tickets-api";

export function buildSlotMap(
  sectors: SectorWithAvailability[],
): Record<SectorName, SectorWithAvailability | null> {
  const map: Record<SectorName, SectorWithAvailability | null> = {
    TRIBUNA: null,
    LATERAL: null,
    "GOL NORD": null,
    "GOL SUD": null,
  };
  for (const sector of sectors) {
    const name = sector.sector_name as SectorName;
    if (name in map) map[name] = sector;
  }
  return map;
}

export function describeSector(
  name: SectorName,
  sector: SectorWithAvailability | null,
): string {
  if (!sector) return `${name} szektor — hamarosan elérhető`;
  if (sector.is_sold_out) return `${name} szektor — betelt`;
  return `${name} szektor — ${sector.available_seats} szabad hely, ${formatPrice(Number(sector.price))} jegyenként`;
}
