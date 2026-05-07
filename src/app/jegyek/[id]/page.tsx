"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import {
  fetchMatchDetail,
  purchaseTickets,
  type MatchDetail,
  type PurchaseResponse,
  type SectorWithAvailability,
} from "@/lib/tickets-api";
import {
  deriveMatchStatus,
  MatchStatusBadge,
} from "@/components/tickets/MatchStatusBadge";
import { StadiumMap } from "@/components/tickets/StadiumMap";
import { SectorListAlt } from "@/components/tickets/SectorListAlt";
import { TicketSelectionPanel } from "@/components/tickets/TicketSelectionPanel";
import { PurchaseSuccess } from "@/components/tickets/PurchaseSuccess";
import { TeamCrest } from "@/components/tickets/TeamCrest";
import { cn } from "@/lib/utils";

/**
 * /jegyek/[id] — match detail with stadium map, selection panel and the
 * post-purchase success view.
 *
 * State machine:
 *   loading        →  initial fetch in flight
 *   browsing       →  data loaded, user is selecting a sector + qty
 *   submitting     →  POST /api/tickets/purchase pending
 *   success        →  tickets minted; we render the digital ticket cards
 *   notFound       →  match doesn't exist (404 from the detail endpoint)
 *
 * Auth strategy: anonymous users can browse the map and play with the
 * selection panel — but once they hit "Jegyvásárlás (demo)" we redirect
 * them to /login with a `returnUrl` so they land back here after auth.
 * This keeps the page useful as a marketing surface while still
 * funnelling logged-out users into the auth flow at the right moment.
 */

interface PurchaseResult {
  response: PurchaseResponse;
  /** The sector that was active at submit time — preserved so the success
   *  view can render the right name even after the underlying sector
   *  state mutates (e.g. seats consumed). */
  sector: SectorWithAvailability;
}

export default function MatchDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const matchId = params?.id;
  const { user, isLoading: authLoading } = useAuth();
  const toast = useToast();

  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PurchaseResult | null>(null);

  // ---------------------------------------------------------------------
  // Initial data load
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!matchId) return;
    const controller = new AbortController();

    // Wrapped in an async IIFE so we don't synchronously call setState
    // inside the effect body — eslint-config-next forbids it under
    // React 19. The microtask boundary lets the initial render settle
    // before we toggle the loading flag.
    void (async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const data = await fetchMatchDetail(matchId, controller.signal);
        if (controller.signal.aborted) return;
        if (!data) {
          setNotFound(true);
          return;
        }
        setDetail(data);
        // Pre-select the first available sector so the panel isn't empty
        // on first render — users can change it freely.
        const firstAvailable = data.sectors.find((s) => !s.is_sold_out);
        setSelectedSectorId(firstAvailable?.id ?? null);
      } catch (err) {
        if (controller.signal.aborted) return;
        toast.error(
          err instanceof Error ? err.message : "Meccs betöltése sikertelen",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [matchId, toast]);

  // ---------------------------------------------------------------------
  // Reload helper — used after a successful purchase to refresh the
  // sector availability counts. We don't refetch eagerly while the
  // success screen is up; it'd cause the available_seats counters in
  // the SVG to flip mid-celebration.
  // ---------------------------------------------------------------------
  const reloadDetail = useCallback(async () => {
    if (!matchId) return;
    try {
      const fresh = await fetchMatchDetail(matchId);
      if (!fresh) {
        setNotFound(true);
        return;
      }
      setDetail(fresh);
      // If the user's previous selection sold out (race condition),
      // pivot to the next available sector.
      const stillAvailable = fresh.sectors.find(
        (s) => s.id === selectedSectorId && !s.is_sold_out,
      );
      if (!stillAvailable) {
        const fallback = fresh.sectors.find((s) => !s.is_sold_out);
        setSelectedSectorId(fallback?.id ?? null);
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Friss adatok betöltése sikertelen",
      );
    }
  }, [matchId, selectedSectorId, toast]);

  const selectedSector = useMemo(() => {
    if (!detail || !selectedSectorId) return null;
    return detail.sectors.find((s) => s.id === selectedSectorId) ?? null;
  }, [detail, selectedSectorId]);

  // ---------------------------------------------------------------------
  // Purchase handler
  // ---------------------------------------------------------------------
  const handlePurchase = useCallback(
    async ({
      quantity,
      couponCode,
    }: {
      quantity: number;
      couponCode: string | null;
    }) => {
      if (!detail || !selectedSector) return;

      // Auth gate — happens here, not on initial load, so the page is
      // browsable while logged out.
      if (!user) {
        const returnUrl = `/jegyek/${detail.match.id}`;
        router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
        return;
      }

      setSubmitting(true);
      try {
        const response = await purchaseTickets({
          match_id: detail.match.id,
          sector_id: selectedSector.id,
          quantity,
          coupon_code: couponCode,
        });
        setResult({ response, sector: selectedSector });
        if (response.warning) {
          toast.error(response.warning);
        } else {
          toast.success(
            `${response.tickets.length} jegy sikeresen lefoglalva.`,
          );
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Jegyvásárlás sikertelen",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [detail, selectedSector, user, router, toast],
  );

  // ---------------------------------------------------------------------
  // Renders
  // ---------------------------------------------------------------------
  if (loading) return <MatchDetailSkeleton />;
  if (notFound || !detail) return <NotFoundState />;

  const { match, sectors } = detail;
  const status = deriveMatchStatus(match.date);
  const isPast = status === "past";

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 sm:py-12 lg:px-10">
      <Link
        href="/jegyek"
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.22em]",
          "text-[var(--text-secondary)] transition-colors duration-200",
          "hover:text-[var(--accent-gold)]",
        )}
      >
        <ArrowLeft size={14} aria-hidden />
        Vissza a meccsekhez
      </Link>

      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="mt-6 space-y-5"
      >
        <div className="flex flex-wrap items-center gap-3">
          <MatchStatusBadge status={status} />
          {match.venue && (
            <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">
              <MapPin size={12} aria-hidden />
              {match.venue}
            </span>
          )}
        </div>

        <h1 className="flex flex-col font-display text-4xl leading-[0.95] tracking-wide text-[var(--text-primary)] sm:text-5xl lg:flex-row lg:items-center lg:gap-6 lg:text-5xl xl:text-6xl">
          <span className="flex min-w-0 items-center gap-3 sm:gap-4">
            <TeamCrest
              url={match.home_team_crest}
              teamName={match.home_team}
              size={64}
              priority
              className="hidden shrink-0 sm:inline-flex sm:h-[72px] sm:w-[72px]"
            />
            <TeamCrest
              url={match.home_team_crest}
              teamName={match.home_team}
              size={48}
              priority
              className="inline-flex shrink-0 sm:hidden"
            />
            <span className="min-w-0 truncate">{match.home_team}</span>
          </span>

          <span className="my-3 flex items-center gap-3 text-base font-normal uppercase tracking-[0.4em] text-[var(--text-muted)] sm:my-4 lg:my-0 lg:mx-2 lg:shrink-0 lg:text-sm">
            <span aria-hidden className="h-px w-8 bg-[var(--glass-border)] sm:w-12 lg:w-6" />
            <span>vs.</span>
            <span aria-hidden className="h-px flex-1 bg-[var(--glass-border)] lg:w-6 lg:flex-none" />
          </span>

          <span className="flex min-w-0 items-center gap-3 sm:gap-4">
            <TeamCrest
              url={match.away_team_crest}
              teamName={match.away_team}
              size={64}
              priority
              className="hidden shrink-0 sm:inline-flex sm:h-[72px] sm:w-[72px]"
            />
            <TeamCrest
              url={match.away_team_crest}
              teamName={match.away_team}
              size={48}
              priority
              className="inline-flex shrink-0 sm:hidden"
            />
            <span className="min-w-0 truncate">{match.away_team}</span>
          </span>
        </h1>

        <p className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <CalendarDays size={14} aria-hidden />
          <time dateTime={match.date}>{formatHero(match.date)}</time>
        </p>
      </motion.section>

      {/* Either the buying flow or the success screen */}
      <AnimatePresence mode="wait">
        {result ? (
          <motion.section
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-10"
          >
            <PurchaseSuccess
              match={match}
              sector={result.sector}
              tickets={result.response.tickets}
              subtotal={result.response.subtotal}
              total={result.response.total}
              coupon={result.response.coupon}
              warning={result.response.warning}
              onBuyAgain={() => {
                setResult(null);
                void reloadDetail();
              }}
            />
          </motion.section>
        ) : (
          <motion.section
            key="buying"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-10"
          >
            {isPast ? (
              <PastMatchNotice />
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr] lg:gap-8">
                {/* Stadium + sector list */}
                <div className="space-y-6">
                  <div
                    className={cn(
                      "glass-card relative overflow-hidden p-5 sm:p-7",
                    )}
                  >
                    <header className="mb-4 flex items-center justify-between gap-3">
                      <p className="font-display text-[11px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
                        Stadion térkép
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Kattints a szektorra
                      </p>
                    </header>

                    <StadiumMap
                      sectors={sectors}
                      selectedSectorId={selectedSectorId}
                      onSelect={setSelectedSectorId}
                    />
                  </div>

                  {/* Mobile-friendly list — always rendered, but we hide it
                      on lg+ where the SVG is comfortably tappable. */}
                  <div className="lg:hidden">
                    <p className="mb-3 font-display text-xs uppercase tracking-[0.32em] text-[var(--text-muted)]">
                      Szektorok listanézetben
                    </p>
                    <SectorListAlt
                      sectors={sectors}
                      selectedSectorId={selectedSectorId}
                      onSelect={setSelectedSectorId}
                    />
                  </div>
                </div>

                {/* Selection panel */}
                <TicketSelectionPanel
                  selectedSector={selectedSector}
                  onPurchase={handlePurchase}
                  isSubmitting={submitting || authLoading}
                  className="h-fit lg:sticky lg:top-24"
                />
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-states
// ---------------------------------------------------------------------------

function MatchDetailSkeleton() {
  return (
    <main className="mx-auto max-w-[1280px] animate-pulse px-4 py-12 sm:px-6 lg:px-10">
      <div className="h-3 w-32 rounded-full bg-[var(--glass-bg-strong)]" />
      <div className="mt-6 space-y-4">
        <div className="h-5 w-44 rounded-full bg-[var(--glass-bg-strong)]" />
        <div className="h-12 w-3/4 rounded-md bg-[var(--glass-bg-strong)]" />
        <div className="h-12 w-2/3 rounded-md bg-[var(--glass-bg-strong)]" />
      </div>
      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="glass-card h-[460px]" />
        <div className="glass-card h-[420px]" />
      </div>
    </main>
  );
}

function NotFoundState() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <p className="font-display text-[11px] uppercase tracking-[0.5em] text-[var(--text-muted)]">
        Hiba
      </p>
      <h1 className="mt-3 font-display text-4xl tracking-wide text-[var(--text-primary)] sm:text-5xl">
        Mérkőzés nem található
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">
        A keresett meccs nem létezik vagy időközben eltávolítottuk a kínálatból.
      </p>
      <Link href="/jegyek" className="glass-button-primary mt-8 inline-flex">
        <ArrowLeft size={14} aria-hidden />
        Vissza a meccsekhez
      </Link>
    </main>
  );
}

function PastMatchNotice() {
  return (
    <div className="glass-card flex flex-col items-center gap-3 p-10 text-center sm:p-14">
      <p className="font-display text-[11px] uppercase tracking-[0.5em] text-[var(--text-muted)]">
        Lejátszott
      </p>
      <h2 className="font-display text-2xl tracking-wide text-[var(--text-primary)] sm:text-3xl">
        Erre a meccsre már nem vásárolható jegy
      </h2>
      <p className="max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
        A találkozó már lezajlott. Az archív oldalon visszanézheted a
        kapcsolódó híreket és a végeredményt.
      </p>
      <Link href="/jegyek" className="glass-button-secondary mt-2">
        Vissza a meccsekhez
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatHero(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const datePart = new Intl.DateTimeFormat("hu-HU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
  const timePart = new Intl.DateTimeFormat("hu-HU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${datePart} · ${timePart}`;
}
