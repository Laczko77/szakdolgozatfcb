"use client";

/**
 * F15.5 — Admin: meccsek és szektorok kezelése.
 *
 * - Sync gomb: POST /api/admin/matches/sync
 * - Lista: GET /api/matches?scope=all
 * - Szektor műveletek a kiválasztott meccshez:
 *     POST /api/admin/matches/[id]/sectors
 *     PUT  /api/admin/matches/[id]/sectors/[sectorId]
 *
 * Tiszta admin UI — `src/components/admin/*` primitívek, NEM glassmorphism.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Info, Pencil, Plus, RefreshCw } from "lucide-react";

import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminButton } from "@/components/admin/AdminButton";
import {
  AdminCard,
  AdminCardHeader,
  AdminCardTitle,
} from "@/components/admin/AdminCard";
import {
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogDescription,
  AdminDialogFooter,
  AdminDialogHeader,
  AdminDialogRoot,
  AdminDialogTitle,
} from "@/components/admin/AdminDialog";
import { AdminField, AdminInput } from "@/components/admin/AdminInput";
import {
  AdminTable,
  AdminTBody,
  AdminTD,
  AdminTH,
  AdminTHead,
  AdminTR,
  AdminTableContainer,
  AdminTableEmpty,
  AdminTableSkeleton,
} from "@/components/admin/AdminTable";
import { adminFetch, adminFetchRaw, AdminApiError } from "@/lib/admin-fetch";
import { cn } from "@/lib/utils";
import type { Match, MatchSector } from "@/types/database";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const dateFormatter = new Intl.DateTimeFormat("hu-HU", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(iso: string): string {
  try {
    return dateFormatter.format(new Date(iso));
  } catch {
    return iso;
  }
}

function statusTone(status: string | null): "success" | "info" | "neutral" {
  if (!status) return "neutral";
  const s = status.toUpperCase();
  if (["LIVE", "1H", "2H", "HT", "ET"].includes(s)) return "success";
  if (["FT", "AET", "PEN"].includes(s)) return "info";
  return "neutral";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const loadMatches = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetchRaw<{ matches: Match[] }>(
        "/api/matches?scope=all&limit=100",
        { signal, cache: "no-store" },
      );
      if (signal?.aborted) return;
      setMatches(data.matches ?? []);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : "Ismeretlen hiba");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    queueMicrotask(() => {
      void loadMatches(ac.signal);
    });
    return () => ac.abort();
  }, [loadMatches]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    setError(null);
    try {
      const result = await adminFetch<{ synced: number; errors: string[] }>(
        "/api/admin/matches/sync",
        {
          method: "POST",
          body: JSON.stringify({ next: 20 }),
        },
      );
      const count = result?.synced ?? 0;
      setSyncMessage(`Szinkronizáció sikeres: ${count} meccs frissítve`);
      await loadMatches();
    } catch (err) {
      setError(
        err instanceof AdminApiError
          ? `Szinkronizáció sikertelen: ${err.message}`
          : "Szinkronizáció sikertelen",
      );
    } finally {
      setSyncing(false);
    }
  };

  const sortedMatches = useMemo(
    () =>
      [...(matches ?? [])].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [matches],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-[0.06em] text-[var(--text-primary)]">
            Meccsek
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            FC Barcelona mérkőzések és jegyszektorok kezelése.
          </p>
        </div>
        <AdminButton onClick={handleSync} loading={syncing}>
          <RefreshCw className="h-4 w-4" />
          {syncing ? "Szinkronizálás folyamatban..." : "Meccsek szinkronizálása"}
        </AdminButton>
      </header>

      <div
        role="note"
        className={cn(
          "flex items-start gap-3 rounded-md border border-[var(--glass-border)]",
          "bg-[var(--bg-tertiary)]/60 px-4 py-3 text-xs text-[var(--text-secondary)]",
        )}
      >
        <Info
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-gold)]"
          aria-hidden
        />
        <p>
          Az adatok a{" "}
          <span className="font-medium text-[var(--text-primary)]">
            football-data.org
          </span>{" "}
          API-ról kerülnek lekérésre.
        </p>
      </div>

      {syncMessage ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400">
          {syncMessage}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-4 py-2 text-sm text-[var(--accent-red)]">
          {error}
        </div>
      ) : null}

      <AdminCard>
        <AdminCardHeader>
          <div>
            <AdminCardTitle>Mérkőzések</AdminCardTitle>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Kattints egy sorra a szektorok kezeléséhez.
            </p>
          </div>
          <span className="text-xs text-[var(--text-muted)]">
            {sortedMatches.length} elem
          </span>
        </AdminCardHeader>

        <AdminTableContainer className="rounded-none border-0 border-t border-[var(--glass-border)]">
          <AdminTable>
            <AdminTHead>
              <tr className="border-b border-[var(--glass-border)]">
                <AdminTH>Hazai csapat</AdminTH>
                <AdminTH>Vendég csapat</AdminTH>
                <AdminTH>Időpont</AdminTH>
                <AdminTH>Helyszín</AdminTH>
                <AdminTH>Státusz</AdminTH>
                <AdminTH className="text-right">Művelet</AdminTH>
              </tr>
            </AdminTHead>
            {loading ? (
              <AdminTableSkeleton columns={6} rows={6} />
            ) : sortedMatches.length === 0 ? (
              <AdminTBody>
                <tr>
                  <td colSpan={6}>
                    <AdminTableEmpty
                      icon={<CalendarDays className="h-5 w-5" />}
                      title="Nincs mérkőzés"
                      description="Indítsd el a szinkronizálást a football-data.org által szolgáltatott meccsek lekéréséhez."
                    />
                  </td>
                </tr>
              </AdminTBody>
            ) : (
              <AdminTBody>
                {sortedMatches.map((m) => (
                  <AdminTR key={m.id}>
                    <AdminTD className="font-medium">{m.home_team}</AdminTD>
                    <AdminTD>{m.away_team}</AdminTD>
                    <AdminTD className="whitespace-nowrap text-[var(--text-secondary)]">
                      {formatDate(m.date)}
                    </AdminTD>
                    <AdminTD className="text-[var(--text-secondary)]">
                      {m.venue ?? "—"}
                    </AdminTD>
                    <AdminTD>
                      <AdminBadge tone={statusTone(m.status)}>
                        {m.status ?? "—"}
                      </AdminBadge>
                    </AdminTD>
                    <AdminTD className="text-right">
                      <AdminButton
                        variant="subtle"
                        size="sm"
                        onClick={() => setSelectedMatch(m)}
                      >
                        Szektorok
                      </AdminButton>
                    </AdminTD>
                  </AdminTR>
                ))}
              </AdminTBody>
            )}
          </AdminTable>
        </AdminTableContainer>
      </AdminCard>

      <SectorsDialog
        match={selectedMatch}
        onClose={() => setSelectedMatch(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sectors dialog (per-match)
// ---------------------------------------------------------------------------

interface SectorsDialogProps {
  match: Match | null;
  onClose: () => void;
}

function SectorsDialog({ match, onClose }: SectorsDialogProps) {
  const [sectors, setSectors] = useState<MatchSector[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSector, setEditingSector] = useState<MatchSector | null>(null);
  const [creating, setCreating] = useState(false);

  const open = match !== null;

  const loadSectors = useCallback(
    async (matchId: string, signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        // NOTE: `/api/matches/[id]` is a *public* endpoint that returns the
        // raw `{ match, sectors }` shape — it does NOT wrap in the
        // `{ data: ... }` envelope. Using `adminFetch` here would unwrap a
        // missing `.data` key and yield `undefined`, which is what caused
        // the F18.1 "Cannot read properties of undefined (reading 'sectors')"
        // crash. We use `adminFetchRaw` and read the top-level fields
        // directly, with a defensive `?? []` fallback.
        const data = await adminFetchRaw<{
          match?: Match;
          sectors?: MatchSector[];
        }>(`/api/matches/${matchId}`, { signal, cache: "no-store" });
        if (signal?.aborted) return;
        setSectors(data?.sectors ?? []);
      } catch (err) {
        if (signal?.aborted) return;
        setError(err instanceof Error ? err.message : "Ismeretlen hiba");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!match) return;
    const ac = new AbortController();
    queueMicrotask(() => {
      void loadSectors(match.id, ac.signal);
    });
    return () => ac.abort();
  }, [match, loadSectors]);

  return (
    <>
      <AdminDialogRoot
        open={open}
        onOpenChange={(next) => (next ? null : onClose())}
      >
        <AdminDialogContent open={open} size="lg">
          <AdminDialogHeader>
            <AdminDialogTitle>
              {match ? `${match.home_team} – ${match.away_team}` : "Szektorok"}
            </AdminDialogTitle>
            {match ? (
              <AdminDialogDescription>
                {formatDate(match.date)}
                {match.venue ? ` · ${match.venue}` : null}
              </AdminDialogDescription>
            ) : null}
          </AdminDialogHeader>
          <AdminDialogBody className="space-y-4">
            {error ? (
              <div className="rounded-md border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-3 py-2 text-sm text-[var(--accent-red)]">
                {error}
              </div>
            ) : null}

            {loading ? (
              <p className="py-6 text-center text-sm text-[var(--text-muted)]">
                Betöltés…
              </p>
            ) : sectors.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                Még nincs szektor ehhez a meccshez.
              </p>
            ) : (
              <AdminTableContainer>
                <AdminTable>
                  <AdminTHead>
                    <tr>
                      <AdminTH>Név</AdminTH>
                      <AdminTH className="text-right">Összes hely</AdminTH>
                      <AdminTH className="text-right">Eladott</AdminTH>
                      <AdminTH className="text-right">Ár</AdminTH>
                      <AdminTH className="w-[1%] whitespace-nowrap" />
                    </tr>
                  </AdminTHead>
                  <AdminTBody>
                    {sectors.map((s) => (
                      <AdminTR key={s.id}>
                        <AdminTD className="font-medium">
                          {s.sector_name}
                        </AdminTD>
                        <AdminTD className="text-right tabular-nums">
                          {s.total_seats}
                        </AdminTD>
                        <AdminTD className="text-right tabular-nums text-[var(--text-secondary)]">
                          {s.sold_seats}
                        </AdminTD>
                        <AdminTD className="text-right tabular-nums">
                          {s.price.toLocaleString("hu-HU")} Ft
                        </AdminTD>
                        <AdminTD className="text-right">
                          <AdminButton
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingSector(s)}
                            aria-label="Szerkesztés"
                          >
                            <Pencil className="h-4 w-4" />
                          </AdminButton>
                        </AdminTD>
                      </AdminTR>
                    ))}
                  </AdminTBody>
                </AdminTable>
              </AdminTableContainer>
            )}
          </AdminDialogBody>
          <AdminDialogFooter>
            <AdminButton variant="subtle" onClick={onClose}>
              Bezárás
            </AdminButton>
            <AdminButton onClick={() => setCreating(true)} disabled={!match}>
              <Plus className="h-4 w-4" />
              Új szektor
            </AdminButton>
          </AdminDialogFooter>
        </AdminDialogContent>
      </AdminDialogRoot>

      {match && creating ? (
        <SectorFormDialog
          mode="create"
          matchId={match.id}
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            if (match) await loadSectors(match.id);
          }}
        />
      ) : null}

      {match && editingSector ? (
        <SectorFormDialog
          mode="edit"
          matchId={match.id}
          sector={editingSector}
          onClose={() => setEditingSector(null)}
          onSaved={async () => {
            setEditingSector(null);
            if (match) await loadSectors(match.id);
          }}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sector form (create + edit)
// ---------------------------------------------------------------------------

interface SectorFormProps {
  mode: "create" | "edit";
  matchId: string;
  sector?: MatchSector;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

function SectorFormDialog({
  mode,
  matchId,
  sector,
  onClose,
  onSaved,
}: SectorFormProps) {
  const [name, setName] = useState(sector?.sector_name ?? "");
  const [totalSeats, setTotalSeats] = useState<string>(
    sector ? String(sector.total_seats) : "",
  );
  const [price, setPrice] = useState<string>(
    sector ? String(sector.price) : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const totalSeatsNum = Number.parseInt(totalSeats, 10);
    const priceNum = Number.parseFloat(price);

    if (!name.trim()) {
      setError("A szektor neve kötelező");
      return;
    }
    if (!Number.isInteger(totalSeatsNum) || totalSeatsNum < 0) {
      setError("Az összes hely nemnegatív egész szám kell legyen");
      return;
    }
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setError("Az ár nemnegatív szám kell legyen");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (mode === "create") {
        await adminFetch(`/api/admin/matches/${matchId}/sectors`, {
          method: "POST",
          body: JSON.stringify({
            sector_name: name.trim(),
            total_seats: totalSeatsNum,
            price: priceNum,
          }),
        });
      } else if (sector) {
        await adminFetch(
          `/api/admin/matches/${matchId}/sectors/${sector.id}`,
          {
            method: "PUT",
            body: JSON.stringify({
              sector_name: name.trim(),
              total_seats: totalSeatsNum,
              price: priceNum,
            }),
          },
        );
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mentés sikertelen");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminDialogRoot open onOpenChange={(next) => (next ? null : onClose())}>
      <AdminDialogContent open size="md">
        <AdminDialogHeader>
          <AdminDialogTitle>
            {mode === "create" ? "Új szektor" : "Szektor szerkesztése"}
          </AdminDialogTitle>
          <AdminDialogDescription>
            {mode === "edit" && sector
              ? `Eladott jegyek: ${sector.sold_seats} (a teljes szám nem mehet ez alá).`
              : "Adj meg nevet, kapacitást és árat."}
          </AdminDialogDescription>
        </AdminDialogHeader>
        <form onSubmit={handleSubmit}>
          <AdminDialogBody className="space-y-4">
            <AdminField label="Szektor neve" htmlFor="sector-name">
              <AdminInput
                id="sector-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </AdminField>
            <div className="grid grid-cols-2 gap-4">
              <AdminField label="Összes hely" htmlFor="total-seats">
                <AdminInput
                  id="total-seats"
                  type="number"
                  min={sector?.sold_seats ?? 0}
                  step={1}
                  value={totalSeats}
                  onChange={(e) => setTotalSeats(e.target.value)}
                  required
                />
              </AdminField>
              <AdminField label="Ár (Ft)" htmlFor="price">
                <AdminInput
                  id="price"
                  type="number"
                  min={0}
                  step={100}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </AdminField>
            </div>
            {error ? (
              <div className="rounded-md border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-3 py-2 text-sm text-[var(--accent-red)]">
                {error}
              </div>
            ) : null}
          </AdminDialogBody>
          <AdminDialogFooter>
            <AdminButton
              type="button"
              variant="subtle"
              onClick={onClose}
              disabled={submitting}
            >
              Mégse
            </AdminButton>
            <AdminButton type="submit" loading={submitting}>
              {mode === "create" ? "Létrehozás" : "Mentés"}
            </AdminButton>
          </AdminDialogFooter>
        </form>
      </AdminDialogContent>
    </AdminDialogRoot>
  );
}
