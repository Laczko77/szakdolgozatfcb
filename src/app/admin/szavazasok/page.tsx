"use client";

/**
 * F15.8 — Admin: szavazások kezelése.
 *
 * - Lista:        GET /api/polls?status=all
 * - Létrehozás:   POST /api/admin/polls
 * - Szerkesztés:  PUT  /api/admin/polls/[id]
 * - Törlés:       DELETE /api/admin/polls/[id]
 * - Lezárás:      PUT  /api/admin/polls/[id]/resolve  (helyes opció kiválasztása
 *                  → automatikus pontszétosztás a szervereldalon)
 *
 * Meccskiválasztáshoz a /api/matches?scope=upcoming endpointot használjuk.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Vote,
} from "lucide-react";

import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminButton } from "@/components/admin/AdminButton";
import {
  AdminCard,
  AdminCardBody,
  AdminCardHeader,
  AdminCardTitle,
} from "@/components/admin/AdminCard";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogDescription,
  AdminDialogFooter,
  AdminDialogHeader,
  AdminDialogRoot,
  AdminDialogTitle,
} from "@/components/admin/AdminDialog";
import {
  AdminField,
  AdminInput,
} from "@/components/admin/AdminInput";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { adminFetch, adminFetchRaw, AdminApiError } from "@/lib/admin-fetch";
import type { Match, Poll, PollOption } from "@/types/database";

type EnrichedPoll = Poll & {
  results: Record<number, number>;
  total_votes: number;
  user_vote: number | null;
};

type FilterStatus = "all" | "active" | "resolved";

const dateFormatter = new Intl.DateTimeFormat("hu-HU", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const NO_MATCH_VALUE = "__none__";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminPollsPage() {
  const [polls, setPolls] = useState<EnrichedPoll[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EnrichedPoll | null>(null);
  const [resolving, setResolving] = useState<EnrichedPoll | null>(null);
  const [deleting, setDeleting] = useState<EnrichedPoll | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadAll = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const [pollsBody, matchesData] = await Promise.all([
        adminFetchRaw<{ polls: EnrichedPoll[] }>("/api/polls?status=all", {
          signal,
          cache: "no-store",
        }),
        adminFetch<Match[]>("/api/matches?scope=upcoming&limit=50", {
          signal,
          cache: "no-store",
        }).catch(() => [] as Match[]),
      ]);
      if (signal?.aborted) return;
      setPolls(pollsBody.polls ?? []);
      setMatches(matchesData ?? []);
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
      void loadAll(ac.signal);
    });
    return () => ac.abort();
  }, [loadAll]);

  const filteredPolls = useMemo(() => {
    if (filter === "all") return polls;
    if (filter === "active") return polls.filter((p) => p.is_active);
    return polls.filter((p) => !p.is_active);
  }, [polls, filter]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await adminFetch(`/api/admin/polls/${deleting.id}`, {
        method: "DELETE",
      });
      setDeleting(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Törlés sikertelen");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-[0.06em] text-[var(--text-primary)]">
            Szavazások
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Tippszavazások készítése és lezárása. Lezáráskor a helyesen tippelő
            felhasználók automatikusan +50 pontot kapnak.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-[160px]">
            <AdminSelect
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterStatus)}
            >
              <option value="all">Összes</option>
              <option value="active">Aktív</option>
              <option value="resolved">Lezárt</option>
            </AdminSelect>
          </div>
          <AdminButton onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Új szavazás
          </AdminButton>
        </div>
      </header>

      {error ? (
        <div className="rounded-md border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-4 py-2 text-sm text-[var(--accent-red)]">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="py-12 text-center text-sm text-[var(--text-muted)]">
          Betöltés…
        </p>
      ) : filteredPolls.length === 0 ? (
        <AdminCard>
          <AdminCardBody>
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--glass-border)] text-[var(--text-muted)]">
                <Vote className="h-5 w-5" />
              </div>
              <p className="font-display text-lg uppercase tracking-[0.08em] text-[var(--text-primary)]">
                Nincs ilyen szavazás
              </p>
              <p className="max-w-md text-sm text-[var(--text-secondary)]">
                Próbálj másik szűrést, vagy hozz létre egy új szavazást.
              </p>
            </div>
          </AdminCardBody>
        </AdminCard>
      ) : (
        <div className="space-y-4">
          {filteredPolls.map((p) => (
            <PollRow
              key={p.id}
              poll={p}
              matches={matches}
              onEdit={() => setEditing(p)}
              onResolve={() => setResolving(p)}
              onDelete={() => setDeleting(p)}
            />
          ))}
        </div>
      )}

      {creating ? (
        <PollFormDialog
          mode="create"
          matches={matches}
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            await loadAll();
          }}
        />
      ) : null}
      {editing ? (
        <PollFormDialog
          mode="edit"
          poll={editing}
          matches={matches}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await loadAll();
          }}
        />
      ) : null}
      {resolving ? (
        <ResolvePollDialog
          poll={resolving}
          onClose={() => setResolving(null)}
          onResolved={async () => {
            setResolving(null);
            await loadAll();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Szavazás törlése"
        description="Biztos, hogy törlöd? A leadott szavazatok is törlődnek."
        confirmLabel="Törlés"
        loading={deleteBusy}
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Poll row
// ---------------------------------------------------------------------------

interface PollRowProps {
  poll: EnrichedPoll;
  matches: Match[];
  onEdit: () => void;
  onResolve: () => void;
  onDelete: () => void;
}

function PollRow({ poll, matches, onEdit, onResolve, onDelete }: PollRowProps) {
  const match = matches.find((m) => m.id === poll.match_id);
  const isResolved = poll.correct_option !== null;
  const totalVotes = poll.total_votes;

  return (
    <AdminCard>
      <AdminCardHeader>
        <div className="space-y-1">
          <AdminCardTitle className="text-base normal-case tracking-normal">
            {poll.question}
          </AdminCardTitle>
          <p className="text-xs text-[var(--text-secondary)]">
            {match
              ? `${match.home_team} – ${match.away_team}`
              : "Általános szavazás"}
            {" · "}
            {dateFormatter.format(new Date(poll.created_at))}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isResolved ? (
            <AdminBadge tone="success">
              <CheckCircle2 className="h-3 w-3" /> Lezárt
            </AdminBadge>
          ) : poll.is_active ? (
            <AdminBadge tone="gold">Aktív</AdminBadge>
          ) : (
            <AdminBadge tone="neutral">Inaktív</AdminBadge>
          )}
          <span className="text-xs text-[var(--text-muted)]">
            {totalVotes} szavazat
          </span>
        </div>
      </AdminCardHeader>
      <AdminCardBody className="space-y-3">
        <ul className="space-y-2">
          {poll.options.map((opt, idx) => {
            const count = poll.results?.[idx] ?? 0;
            const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
            const isCorrect = idx === poll.correct_option;
            return (
              <li
                key={idx}
                className={
                  isCorrect
                    ? "relative overflow-hidden rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2"
                    : "relative overflow-hidden rounded-md border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2"
                }
              >
                <div
                  className={
                    isCorrect
                      ? "absolute inset-y-0 left-0 bg-emerald-500/15"
                      : "absolute inset-y-0 left-0 bg-[var(--glass-bg-hover)]"
                  }
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
                <div className="relative flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-[var(--text-primary)]">
                    {opt.label}
                    {isCorrect ? (
                      <span className="ml-2 text-xs text-emerald-400">
                        ✓ helyes
                      </span>
                    ) : null}
                  </span>
                  <span className="tabular-nums text-[var(--text-secondary)]">
                    {count} ({pct.toFixed(0)}%)
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {!isResolved ? (
            <AdminButton variant="subtle" size="sm" onClick={onResolve}>
              <Lock className="h-4 w-4" /> Lezárás
            </AdminButton>
          ) : null}
          <AdminButton variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4" /> Szerkesztés
          </AdminButton>
          <AdminButton
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-[var(--accent-red)] hover:bg-[var(--accent-red)]/10 hover:text-[var(--accent-red)]"
          >
            <Trash2 className="h-4 w-4" /> Törlés
          </AdminButton>
        </div>
      </AdminCardBody>
    </AdminCard>
  );
}

// ---------------------------------------------------------------------------
// Create / edit form
// ---------------------------------------------------------------------------

interface PollFormProps {
  mode: "create" | "edit";
  poll?: EnrichedPoll;
  matches: Match[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

function PollFormDialog({
  mode,
  poll,
  matches,
  onClose,
  onSaved,
}: PollFormProps) {
  const [question, setQuestion] = useState(poll?.question ?? "");
  const [options, setOptions] = useState<string[]>(
    poll?.options.map((o) => o.label) ?? ["", ""],
  );
  const [matchId, setMatchId] = useState<string>(
    poll?.match_id ?? NO_MATCH_VALUE,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isResolved =
    poll?.correct_option !== null && poll?.correct_option !== undefined;
  const optionsLocked = mode === "edit" && isResolved;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) {
      setError("A kérdés kötelező");
      return;
    }
    const trimmed = options.map((o) => o.trim()).filter((o) => o.length > 0);
    if (trimmed.length < 2) {
      setError("Legalább 2 opció szükséges");
      return;
    }

    setSubmitting(true);
    setError(null);

    const payloadOptions: PollOption[] = trimmed.map((label) => ({ label }));
    const payloadMatchId = matchId === NO_MATCH_VALUE ? null : matchId;

    try {
      if (mode === "create") {
        await adminFetch("/api/admin/polls", {
          method: "POST",
          body: JSON.stringify({
            question: question.trim(),
            options: payloadOptions,
            match_id: payloadMatchId,
          }),
        });
      } else if (poll) {
        const body: Record<string, unknown> = {
          question: question.trim(),
          match_id: payloadMatchId,
        };
        if (!optionsLocked) {
          body.options = payloadOptions;
        }
        await adminFetch(`/api/admin/polls/${poll.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
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
            {mode === "create" ? "Új szavazás" : "Szavazás szerkesztése"}
          </AdminDialogTitle>
          <AdminDialogDescription>
            {optionsLocked
              ? "A szavazás lezárva — csak a kérdés és a meccs kötés módosítható."
              : "Add meg a kérdést és legalább két opciót."}
          </AdminDialogDescription>
        </AdminDialogHeader>
        <form onSubmit={handleSubmit}>
          <AdminDialogBody className="space-y-4">
            <AdminField label="Kérdés" htmlFor="question">
              <AdminInput
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                required
              />
            </AdminField>

            <AdminField label="Opciók">
              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <AdminInput
                      value={opt}
                      onChange={(e) => {
                        const next = [...options];
                        next[idx] = e.target.value;
                        setOptions(next);
                      }}
                      placeholder={`${idx + 1}. opció`}
                      disabled={optionsLocked}
                    />
                    <AdminButton
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setOptions(options.filter((_, i) => i !== idx))
                      }
                      disabled={optionsLocked || options.length <= 2}
                      aria-label="Opció törlése"
                    >
                      <Trash2 className="h-4 w-4" />
                    </AdminButton>
                  </div>
                ))}
                {!optionsLocked ? (
                  <AdminButton
                    type="button"
                    variant="subtle"
                    size="sm"
                    onClick={() => setOptions([...options, ""])}
                  >
                    <Plus className="h-4 w-4" /> Opció hozzáadása
                  </AdminButton>
                ) : null}
              </div>
            </AdminField>

            <AdminField
              label="Kapcsolódó meccs (opcionális)"
              htmlFor="match"
            >
              <AdminSelect
                id="match"
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
              >
                <option value={NO_MATCH_VALUE}>Nincs meccs</option>
                {(matches ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.home_team} – {m.away_team} (
                    {dateFormatter.format(new Date(m.date))})
                  </option>
                ))}
              </AdminSelect>
            </AdminField>

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

// ---------------------------------------------------------------------------
// Resolve poll
// ---------------------------------------------------------------------------

interface ResolveProps {
  poll: EnrichedPoll;
  onClose: () => void;
  onResolved: () => void | Promise<void>;
}

function ResolvePollDialog({ poll, onClose, onResolved }: ResolveProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);

  const handleResolve = async () => {
    if (selected === null) {
      setError("Válassz ki egy helyes opciót");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/polls/${poll.id}/resolve`, {
        method: "PUT",
        body: JSON.stringify({ correct_option: selected }),
      });
      await onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lezárás sikertelen");
      setConfirmStep(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminDialogRoot open onOpenChange={(next) => (next ? null : onClose())}>
      <AdminDialogContent open size="md">
        <AdminDialogHeader>
          <AdminDialogTitle>Szavazás lezárása</AdminDialogTitle>
          <AdminDialogDescription>
            {confirmStep
              ? "Megerősítés: a választott opció szerint kerülnek kiosztásra a pontok. Ez a művelet nem vonható vissza."
              : "Válaszd ki a helyes választ. A nyertesek automatikusan +50 pontot kapnak."}
          </AdminDialogDescription>
        </AdminDialogHeader>
        <AdminDialogBody className="space-y-3">
          <p className="rounded-md border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2 text-sm font-medium text-[var(--text-primary)]">
            {poll.question}
          </p>
          <div className="space-y-2">
            {poll.options.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => !confirmStep && setSelected(idx)}
                disabled={confirmStep}
                className={
                  selected === idx
                    ? "flex w-full items-center justify-between rounded-md border border-[var(--accent-gold)] bg-[var(--accent-gold)]/10 px-3 py-2 text-left text-sm font-medium text-[var(--text-primary)] transition-colors disabled:cursor-not-allowed"
                    : "flex w-full items-center justify-between rounded-md border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--glass-bg-hover)] disabled:cursor-not-allowed"
                }
              >
                <span>{opt.label}</span>
                {selected === idx ? (
                  <CheckCircle2 className="h-4 w-4 text-[var(--accent-gold)]" />
                ) : null}
              </button>
            ))}
          </div>
          {error ? (
            <div className="rounded-md border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-3 py-2 text-sm text-[var(--accent-red)]">
              {error}
            </div>
          ) : null}
        </AdminDialogBody>
        <AdminDialogFooter>
          {confirmStep ? (
            <>
              <AdminButton
                variant="subtle"
                onClick={() => setConfirmStep(false)}
                disabled={submitting}
              >
                Vissza
              </AdminButton>
              <AdminButton
                variant="danger"
                onClick={handleResolve}
                loading={submitting}
              >
                Lezárás megerősítése
              </AdminButton>
            </>
          ) : (
            <>
              <AdminButton variant="subtle" onClick={onClose}>
                Mégse
              </AdminButton>
              <AdminButton
                onClick={() => {
                  if (selected === null) {
                    setError("Válassz ki egy helyes opciót");
                    return;
                  }
                  setError(null);
                  setConfirmStep(true);
                }}
              >
                Tovább
              </AdminButton>
            </>
          )}
        </AdminDialogFooter>
      </AdminDialogContent>
    </AdminDialogRoot>
  );
}
