"use client";

/**
 * F15.6 — Admin: játékosok kezelése.
 *
 * - Sync: POST /api/admin/players/sync (név/pozíció/szám/statisztikák
 *   football-data.org alapján — admin kézi mező csak `bio` és `image_url`).
 * - Lista: GET /api/players
 * - Szerkesztés: PUT /api/admin/players/[id] (multipart, mezők: bio, image)
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ImageOff, Info, Pencil, RefreshCw, Users } from "lucide-react";

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
import {
  AdminField,
  AdminTextarea,
} from "@/components/admin/AdminInput";
import { ImageDropzone } from "@/components/admin/ImageDropzone";
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
import type { Player } from "@/types/database";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Player | null>(null);

  const loadPlayers = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetchRaw<{ players: Player[] }>("/api/players", {
        signal,
        cache: "no-store",
      });
      if (signal?.aborted) return;
      setPlayers(res?.players ?? []);
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
      void loadPlayers(ac.signal);
    });
    return () => ac.abort();
  }, [loadPlayers]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    setError(null);
    try {
      const result = await adminFetch<{ synced: number; errors: string[] }>(
        "/api/admin/players/sync",
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );
      const count = result?.synced ?? 0;
      setSyncMessage(`Szinkronizáció sikeres: ${count} játékos frissítve`);
      await loadPlayers();
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

  const sortedPlayers = useMemo(
    () =>
      [...(players ?? [])].sort((a, b) => {
        const posCmp = (a.position ?? "").localeCompare(b.position ?? "");
        if (posCmp !== 0) return posCmp;
        return (a.number ?? 999) - (b.number ?? 999);
      }),
    [players],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-[0.06em] text-[var(--text-primary)]">
            Játékosok
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            FC Barcelona keret. A szinkronizáláskor automatikusan frissülő mezők
            felülíródnak — csak a bio és a kép szerkeszthető kézzel.
          </p>
        </div>
        <AdminButton onClick={handleSync} loading={syncing}>
          <RefreshCw className="h-4 w-4" />
          {syncing ? "Szinkronizálás folyamatban..." : "Játékosok szinkronizálása"}
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
          API-ról kerülnek lekérésre. A játékos képek az admin panelen manuálisan
          tölthetők fel.
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
            <AdminCardTitle>Keret</AdminCardTitle>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {sortedPlayers.length} játékos a jelenlegi szezonban.
            </p>
          </div>
        </AdminCardHeader>
        <AdminTableContainer className="rounded-none border-0 border-t border-[var(--glass-border)]">
          <AdminTable>
            <AdminTHead>
              <tr className="border-b border-[var(--glass-border)]">
                <AdminTH className="w-16">Kép</AdminTH>
                <AdminTH>Név</AdminTH>
                <AdminTH>Pozíció</AdminTH>
                <AdminTH className="text-right">Mezszám</AdminTH>
                <AdminTH>Bio</AdminTH>
                <AdminTH className="text-right">Művelet</AdminTH>
              </tr>
            </AdminTHead>
            {loading ? (
              <AdminTableSkeleton columns={6} rows={6} />
            ) : sortedPlayers.length === 0 ? (
              <AdminTBody>
                <tr>
                  <td colSpan={6}>
                    <AdminTableEmpty
                      icon={<Users className="h-5 w-5" />}
                      title="Nincs játékos"
                      description="Indítsd el a szinkronizálást a keret betöltéséhez."
                    />
                  </td>
                </tr>
              </AdminTBody>
            ) : (
              <AdminTBody>
                {sortedPlayers.map((p) => (
                  <AdminTR key={p.id}>
                    <AdminTD>
                      <PlayerThumb url={p.image_url} alt={p.name} />
                    </AdminTD>
                    <AdminTD className="font-medium">{p.name}</AdminTD>
                    <AdminTD>
                      <AdminBadge tone="info">{p.position ?? "—"}</AdminBadge>
                    </AdminTD>
                    <AdminTD className="text-right tabular-nums">
                      {p.number ?? "—"}
                    </AdminTD>
                    <AdminTD className="max-w-[24ch] truncate text-[var(--text-secondary)]">
                      {p.bio ?? "—"}
                    </AdminTD>
                    <AdminTD className="text-right">
                      <AdminButton
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditing(p)}
                        aria-label="Szerkesztés"
                      >
                        <Pencil className="h-4 w-4" />
                      </AdminButton>
                    </AdminTD>
                  </AdminTR>
                ))}
              </AdminTBody>
            )}
          </AdminTable>
        </AdminTableContainer>
      </AdminCard>

      {editing ? (
        <PlayerEditDialog
          player={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await loadPlayers();
          }}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function PlayerThumb({ url, alt }: { url: string | null; alt: string }) {
  if (!url) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
        <ImageOff className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div className="relative h-10 w-10 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
      <Image src={url} alt={alt} fill sizes="40px" className="object-cover" />
    </div>
  );
}

interface EditDialogProps {
  player: Player;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

function PlayerEditDialog({ player, onClose, onSaved }: EditDialogProps) {
  const [bio, setBio] = useState(player.bio ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (bio.trim() === (player.bio ?? "").trim() && !imageFile) {
      setError("Nincs változtatás");
      return;
    }

    setSubmitting(true);

    const formData = new FormData();
    if (bio !== (player.bio ?? "")) {
      formData.append("bio", bio);
    }
    if (imageFile) {
      formData.append("image", imageFile);
    }

    try {
      await adminFetch(`/api/admin/players/${player.id}`, {
        method: "PUT",
        body: formData,
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mentés sikertelen");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminDialogRoot open onOpenChange={(next) => (next ? null : onClose())}>
      <AdminDialogContent open size="lg">
        <AdminDialogHeader>
          <AdminDialogTitle>{player.name}</AdminDialogTitle>
          <AdminDialogDescription>
            {player.position ?? "Pozíció ismeretlen"} · #{player.number ?? "—"}
          </AdminDialogDescription>
        </AdminDialogHeader>
        <form onSubmit={handleSubmit}>
          <AdminDialogBody className="space-y-5">
            <AdminField label="Játékos képe">
              <ImageDropzone
                file={imageFile}
                existingUrl={player.image_url}
                onFileChange={setImageFile}
              />
            </AdminField>
            <AdminField label="Bio" htmlFor="bio">
              <AdminTextarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={6}
                placeholder="Játékos rövid bemutatása…"
              />
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
              Mentés
            </AdminButton>
          </AdminDialogFooter>
        </form>
      </AdminDialogContent>
    </AdminDialogRoot>
  );
}
