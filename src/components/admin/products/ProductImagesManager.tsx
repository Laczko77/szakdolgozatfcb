"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  ImagePlus,
  Loader2,
  Star,
  StarOff,
  UploadCloud,
  X,
} from "lucide-react";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { cn } from "@/lib/utils";

/**
 * F32.5 — Admin product gallery manager.
 *
 * Self-contained block embedded into `ProductEditor`. Loads its own
 * gallery list (from the public detail endpoint), then talks to the four
 * admin image endpoints:
 *   - POST   /api/admin/products/[id]/images
 *   - PUT    /api/admin/products/[id]/images/order
 *   - PUT    /api/admin/products/[id]/images/[imageId]/cover
 *   - DELETE /api/admin/products/[id]/images/[imageId]
 *
 * Reorder uses `@dnd-kit/sortable` with explicit Mouse + Touch sensors
 * (delay: 150ms on touch) so a touch-list scroll doesn't accidentally
 * start a drag. After a successful drop we PUT the new full ordering.
 *
 * The single-cover invariant lives at the DB layer; locally we still
 * mirror it after a successful PUT cover so the UI updates without a
 * round-trip refresh.
 */

const MAX_IMAGES = 10;

// Mirror of `ProductImagePublic` from the public shop API. Duplicated
// locally to keep the admin bundle's dep graph isolated from the public
// shop helpers.
interface GalleryImage {
  id: string;
  image_url: string;
  display_order: number;
  is_cover: boolean;
}

interface ProductImagesManagerProps {
  productId: string;
  /**
   * Bumped by the parent when external mutations (e.g. a successful POST
   * via the legacy single-image dropzone) should trigger a reload.
   */
  reloadKey?: number;
}

export function ProductImagesManager({
  productId,
  reloadKey,
}: ProductImagesManagerProps) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragHover, setDragHover] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [coverPendingId, setCoverPendingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/products/${productId}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Galéria betöltése sikertelen");
      }
      const data = (await response.json()) as {
        product: { images?: GalleryImage[] };
      };
      setImages(data.product.images ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Galéria betöltése sikertelen",
      );
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    queueMicrotask(() => {
      void reload();
    });
  }, [reload, reloadKey]);

  // ---- Upload --------------------------------------------------------

  const remaining = Math.max(0, MAX_IMAGES - images.length);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const list = Array.from(files).slice(0, remaining);
      if (list.length === 0) {
        setError(
          `Egy termékhez maximum ${MAX_IMAGES} kép tartozhat — törölj egy meglévőt.`,
        );
        return;
      }
      setUploading(true);
      setError(null);
      try {
        const formData = new FormData();
        for (const file of list) {
          formData.append("images", file);
        }
        const response = await fetch(
          `/api/admin/products/${productId}/images`,
          {
            method: "POST",
            body: formData,
          },
        );
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? "Képfeltöltés sikertelen");
        }
        // The POST returns *only the just-uploaded* images. Reload to get
        // the canonical full ordered gallery (and a fresh cover state).
        await reload();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Képfeltöltés sikertelen",
        );
      } finally {
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [productId, reload, remaining],
  );

  // ---- Cover ---------------------------------------------------------

  const handleSetCover = useCallback(
    async (imageId: string) => {
      // Optimistic local mirror — flip is_cover on the chosen row, clear
      // it on every other. Reverted on error.
      const prev = images;
      setCoverPendingId(imageId);
      setImages((current) =>
        current.map((img) => ({ ...img, is_cover: img.id === imageId })),
      );
      try {
        const response = await fetch(
          `/api/admin/products/${productId}/images/${imageId}/cover`,
          { method: "PUT" },
        );
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? "Cover beállítása sikertelen");
        }
        // The endpoint returns the canonical sorted gallery — adopt it
        // so display_order stays in sync if the trigger touched it.
        const json = (await response.json()) as {
          data: { images: GalleryImage[] };
        };
        if (json?.data?.images) {
          setImages(json.data.images);
        }
      } catch (err) {
        setImages(prev);
        setError(
          err instanceof Error ? err.message : "Cover beállítása sikertelen",
        );
      } finally {
        setCoverPendingId(null);
      }
    },
    [productId, images],
  );

  // ---- Delete --------------------------------------------------------

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/products/${productId}/images/${pendingDeleteId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Törlés sikertelen");
      }
      setPendingDeleteId(null);
      // The trigger may have promoted a new cover — reload picks it up.
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Törlés sikertelen");
    } finally {
      setDeleting(false);
    }
  }, [pendingDeleteId, productId, reload]);

  // ---- Reorder (dnd-kit) --------------------------------------------

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = images.findIndex((img) => img.id === active.id);
      const newIndex = images.findIndex((img) => img.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;

      // Optimistic local reorder — server PUT updates display_order to
      // match the new array index. Reverted on error.
      const prev = images;
      const reordered = arrayMove(images, oldIndex, newIndex).map(
        (img, idx) => ({ ...img, display_order: idx }),
      );
      setImages(reordered);

      try {
        const response = await fetch(
          `/api/admin/products/${productId}/images/order`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              reordered.map((img) => ({
                image_id: img.id,
                display_order: img.display_order,
              })),
            ),
          },
        );
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? "Sorrend mentése sikertelen");
        }
        const json = (await response.json()) as {
          data: { images: GalleryImage[] };
        };
        if (json?.data?.images) {
          setImages(json.data.images);
        }
      } catch (err) {
        setImages(prev);
        setError(
          err instanceof Error ? err.message : "Sorrend mentése sikertelen",
        );
      }
    },
    [images, productId],
  );

  // ---- Render --------------------------------------------------------

  return (
    <div className="space-y-3">
      {/* Header row with the count and the limit hint. */}
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
          {images.length} / {MAX_IMAGES} kép
        </div>
        {images.length > 0 && (
          <p className="text-[11px] text-[var(--text-muted)]">
            Húzd a kártyát a sorrendhez · Cover = listaképként jelenik meg
          </p>
        )}
      </div>

      {/* Grid of existing images */}
      {loading ? (
        <GallerySkeleton />
      ) : images.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={images.map((img) => img.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {images.map((image) => (
                <SortableImageCard
                  key={image.id}
                  image={image}
                  onSetCover={() => void handleSetCover(image.id)}
                  onDelete={() => setPendingDeleteId(image.id)}
                  coverPending={coverPendingId === image.id}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div
          className={cn(
            "rounded-md border border-dashed border-[var(--glass-border)]",
            "bg-[var(--bg-primary)] px-4 py-10 text-center",
          )}
        >
          <p className="text-sm text-[var(--text-secondary)]">
            Még nincs feltöltött galériakép.
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Az első feltöltött kép automatikusan cover lesz.
          </p>
        </div>
      )}

      {/* Upload zone — shown only when there's still room. */}
      {remaining > 0 && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragHover(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragHover(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragHover(false);
            void handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Képek hozzáadása"
          className={cn(
            "group flex cursor-pointer flex-col items-center justify-center gap-2",
            "rounded-md border-2 border-dashed bg-[var(--bg-primary)] px-4 py-6 text-center",
            "transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
            dragHover
              ? "border-[var(--accent-gold)] bg-[var(--accent-gold)]/5"
              : "border-[var(--glass-border)] hover:border-[var(--accent-gold)]/60",
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            multiple
            className="sr-only"
            onChange={(e) => void handleFiles(e.target.files)}
            disabled={uploading}
          />
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-[var(--accent-gold)]" />
            ) : dragHover ? (
              <UploadCloud className="h-4 w-4 text-[var(--accent-gold)]" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
          </div>
          <p className="font-display text-xs uppercase tracking-[0.18em] text-[var(--text-primary)]">
            {uploading
              ? "Feltöltés folyamatban…"
              : dragHover
                ? "Engedd el a feltöltéshez"
                : "Képek hozzáadása"}
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">
            Kattints, vagy húzd ide a fájlokat · még {remaining} kép tölthető
            fel · max 8 MB / kép
          </p>
        </div>
      )}

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-3 py-2 text-xs text-[var(--accent-red)]"
        >
          {error}
        </p>
      ) : null}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(o) => !o && setPendingDeleteId(null)}
        title="Kép törlése"
        description={
          <>
            Biztosan törölni szeretnéd ezt a képet? A művelet nem
            visszafordítható. Ha ez volt a cover, automatikusan a következő
            kép lép a helyébe.
          </>
        }
        confirmLabel="Törlés"
        variant="danger"
        loading={deleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableImageCard — a single drag-handle + thumbnail tile
// ---------------------------------------------------------------------------

interface SortableImageCardProps {
  image: GalleryImage;
  onSetCover: () => void;
  onDelete: () => void;
  coverPending: boolean;
}

function SortableImageCard({
  image,
  onSetCover,
  onDelete,
  coverPending,
}: SortableImageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative overflow-hidden rounded-md",
        "border border-[var(--glass-border)] bg-[var(--bg-secondary)]",
        image.is_cover && "ring-2 ring-[var(--accent-gold)]",
        isDragging && "shadow-lg",
      )}
    >
      <div className="relative aspect-square w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.image_url}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />

        {/* Cover badge — top-left, only when this image is the cover. */}
        {image.is_cover && (
          <div className="absolute top-2 left-2 z-10">
            <AdminBadge tone="warning">
              <Star className="mr-1 h-3 w-3 fill-current" />
              Cover
            </AdminBadge>
          </div>
        )}

        {/* Drag handle — top-right. Prevented from triggering the card
            click; only this element is the drag origin. */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Sorrend módosítása"
          className={cn(
            "absolute top-2 right-2 z-10",
            "flex h-7 w-7 items-center justify-center rounded-full",
            "bg-black/55 text-white border border-white/15 backdrop-blur-md",
            "cursor-grab active:cursor-grabbing",
            "transition-opacity duration-150",
            "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            "touch-none",
          )}
          onClick={(e) => e.preventDefault()}
        >
          <GripVertical size={14} />
        </button>

        {/* Action overlay — bottom strip with cover toggle + delete */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 z-10",
            "flex items-center justify-between gap-1 px-2 py-2",
            "bg-gradient-to-t from-black/85 to-transparent",
          )}
        >
          <button
            type="button"
            onClick={onSetCover}
            disabled={image.is_cover || coverPending}
            aria-label={
              image.is_cover ? "Ez már a cover" : "Beállítás coverként"
            }
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1",
              "text-[10px] font-semibold uppercase tracking-[0.12em]",
              "border transition-colors duration-150",
              image.is_cover
                ? "border-[var(--accent-gold)] bg-[var(--accent-gold)] text-black cursor-default"
                : "border-white/25 bg-white/10 text-white hover:bg-white/20",
              coverPending && "opacity-60",
            )}
          >
            {coverPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : image.is_cover ? (
              <Star className="h-3 w-3 fill-current" />
            ) : (
              <StarOff className="h-3 w-3" />
            )}
            {image.is_cover ? "Cover" : "Cover"}
          </button>

          <button
            type="button"
            onClick={onDelete}
            aria-label="Kép törlése"
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full",
              "border border-white/20 bg-black/60 text-white",
              "hover:bg-[var(--accent-red)]/80 transition-colors duration-150",
            )}
          >
            <X size={13} strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton — shown while the gallery is loading on first mount
// ---------------------------------------------------------------------------

function GallerySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={idx}
          className="aspect-square animate-pulse rounded-md bg-[var(--glass-bg-strong)]"
        />
      ))}
    </div>
  );
}
