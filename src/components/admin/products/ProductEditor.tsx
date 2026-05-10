"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, Tag, Trash2 } from "lucide-react";
import type { Product, ProductVariant } from "@/types/database";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminBadge } from "@/components/admin/AdminBadge";
import {
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogFooter,
  AdminDialogHeader,
  AdminDialogRoot,
  AdminDialogTitle,
} from "@/components/admin/AdminDialog";
import {
  AdminField,
  AdminInput,
  AdminTextarea,
} from "@/components/admin/AdminInput";
import { ImageDropzone } from "@/components/admin/ImageDropzone";
import { ProductImagesManager } from "@/components/admin/products/ProductImagesManager";
import {
  VariantsEditor,
  makeEmptyVariant,
  type VariantDraft,
} from "./VariantsEditor";

interface ProductEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, we're editing. */
  product: Product | null;
  /** Pre-fetched variants for the product being edited (empty array on create). */
  initialVariants: ProductVariant[];
  onSaved: () => void;
}

interface FormState {
  name: string;
  description: string;
  category: string;
  price: string; // string for the input, parsed on submit
  imageFile: File | null;
  removeExistingImage: boolean;
  variants: VariantDraft[];
  // F29 — sale fields. Strings because the inputs are number/datetime-local;
  // parsed on submit. Empty string == "no value" (sale cleared).
  salePrice: string;
  saleStartsAt: string;
  saleEndsAt: string;
}

const EMPTY: FormState = {
  name: "",
  description: "",
  category: "",
  price: "",
  imageFile: null,
  removeExistingImage: false,
  variants: [],
  salePrice: "",
  saleStartsAt: "",
  saleEndsAt: "",
};

/**
 * `<input type="datetime-local">` works with the local-tz string
 * `YYYY-MM-DDTHH:mm`, NOT the ISO Z timestamps the API returns. We slice
 * off the trailing `Z`/seconds when seeding the form, and re-attach an
 * ISO conversion on submit.
 */
function isoToDateTimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Use the local-tz components so the picker shows the same wall-clock
  // time the admin originally entered.
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function dateTimeLocalToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// Five sale states surfaced by SaleStatusBadge — see the helper at the
// bottom of this file.
type SaleStatus =
  | { kind: "none" }
  | { kind: "active"; days: number }
  | { kind: "active-open" }
  | { kind: "scheduled"; days: number }
  | { kind: "expired" };

export function ProductEditor({
  open,
  onOpenChange,
  product,
  initialVariants,
  onSaved,
}: ProductEditorProps) {
  const [state, setState] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Reset form on open/edit toggle. queueMicrotask defers setState out of
  // the effect body (react-hooks/set-state-in-effect lint rule under
  // React 19 + eslint-config-next).
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      if (product) {
        setState({
          name: product.name,
          description: product.description ?? "",
          category: product.category ?? "",
          price: product.price.toString(),
          imageFile: null,
          removeExistingImage: false,
          variants: initialVariants.map((v) => ({
            id: v.id,
            size: v.size ?? "",
            color: v.color ?? "",
            stock: v.stock,
            _key: v.id,
          })),
          salePrice:
            product.sale_price !== null && product.sale_price !== undefined
              ? String(product.sale_price)
              : "",
          saleStartsAt: isoToDateTimeLocal(product.sale_starts_at),
          saleEndsAt: isoToDateTimeLocal(product.sale_ends_at),
        });
      } else {
        setState({ ...EMPTY, variants: [makeEmptyVariant()] });
      }
      setErrors({});
      setServerError(null);
    });
  }, [open, product, initialVariants]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!state.name.trim()) next.name = "A név kötelező";
    const priceNum = Number.parseFloat(state.price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      next.price = "Érvénytelen ár";
    }
    if (state.variants.some((v) => v.stock === "" || (v.stock as number) < 0)) {
      next.variants = "Minden variánsnak érvényes készlet értéket kell tartalmaznia";
    }

    // F29 — sale-pricing validation. Empty salePrice == "no sale", which is
    // valid. When a sale price is provided we enforce:
    //   - positive number, strictly less than the catalogue price
    //   - if both timestamps are present, end must be strictly after start
    if (state.salePrice.trim() !== "") {
      const sp = Number.parseFloat(state.salePrice);
      if (!Number.isFinite(sp) || sp <= 0) {
        next.salePrice = "Az akciós ár pozitív szám kell legyen";
      } else if (Number.isFinite(priceNum) && sp >= priceNum) {
        next.salePrice = "Az akciós árnak kisebbnek kell lennie az alapárnál";
      }

      const startMs = state.saleStartsAt
        ? new Date(state.saleStartsAt).getTime()
        : null;
      const endMs = state.saleEndsAt
        ? new Date(state.saleEndsAt).getTime()
        : null;
      if (state.saleStartsAt && Number.isNaN(startMs!)) {
        next.saleStartsAt = "Érvénytelen kezdő időpont";
      }
      if (state.saleEndsAt && Number.isNaN(endMs!)) {
        next.saleEndsAt = "Érvénytelen befejező időpont";
      }
      if (
        startMs !== null &&
        endMs !== null &&
        Number.isFinite(startMs) &&
        Number.isFinite(endMs) &&
        startMs >= endMs
      ) {
        next.saleEndsAt = "Az akció vége a kezdés után kell legyen";
      }
    } else {
      // No sale price → reject orphan timestamps (UX clarity, not a hard
      // server constraint; the API tolerates orphans but the form should
      // mirror "all-or-nothing" intent).
      if (state.saleStartsAt || state.saleEndsAt) {
        next.salePrice =
          "Akciós ár nélkül nem adhatsz meg időablakot";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // Capture "now" once when the dialog opens so the saleStatus useMemo
  // stays pure (react-hooks/purity disallows Date.now() during render).
  // The status only needs to be coarse-grained — "active / scheduled /
  // expired" don't flicker on a sub-second cadence — and re-opening the
  // dialog refreshes the snapshot.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => setNow(Date.now()));
  }, [open]);

  // Derived "live" sale status indicator shown next to the sale section
  // header. Uses the same rules as the public storefront (`isSaleActive`)
  // — duplicated here to avoid a circular dep on a public-shop helper
  // from inside the admin bundle.
  const saleStatus = useMemo<SaleStatus>(() => {
    const sp = Number.parseFloat(state.salePrice);
    if (state.salePrice.trim() === "" || !Number.isFinite(sp) || sp <= 0) {
      return { kind: "none" };
    }
    const startMs = state.saleStartsAt
      ? new Date(state.saleStartsAt).getTime()
      : null;
    const endMs = state.saleEndsAt
      ? new Date(state.saleEndsAt).getTime()
      : null;
    if (endMs !== null && Number.isFinite(endMs) && now >= endMs) {
      return { kind: "expired" };
    }
    if (startMs !== null && Number.isFinite(startMs) && now < startMs) {
      const days = Math.max(
        1,
        Math.ceil((startMs - now) / (24 * 60 * 60 * 1000)),
      );
      return { kind: "scheduled", days };
    }
    if (endMs !== null && Number.isFinite(endMs)) {
      const days = Math.max(
        1,
        Math.ceil((endMs - now) / (24 * 60 * 60 * 1000)),
      );
      return { kind: "active", days };
    }
    return { kind: "active-open" };
  }, [state.salePrice, state.saleStartsAt, state.saleEndsAt, now]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setServerError(null);

    try {
      const formData = new FormData();
      formData.append("name", state.name.trim());
      if (state.description.trim()) {
        formData.append("description", state.description.trim());
      }
      if (state.category.trim()) {
        formData.append("category", state.category.trim());
      }
      formData.append("price", state.price);
      if (state.imageFile) formData.append("image", state.imageFile);

      // F29 — sale fields. Always send all three on update so an admin
      // can clear the sale by emptying the inputs (the API treats empty
      // string as null). On create we omit the keys when empty so they
      // don't insert NULLs that would never round-trip back as anything
      // visible.
      if (product) {
        formData.append("sale_price", state.salePrice.trim());
        formData.append(
          "sale_starts_at",
          dateTimeLocalToIso(state.saleStartsAt) ?? "",
        );
        formData.append(
          "sale_ends_at",
          dateTimeLocalToIso(state.saleEndsAt) ?? "",
        );
      } else if (state.salePrice.trim() !== "") {
        formData.append("sale_price", state.salePrice.trim());
        if (state.saleStartsAt) {
          formData.append(
            "sale_starts_at",
            dateTimeLocalToIso(state.saleStartsAt) ?? "",
          );
        }
        if (state.saleEndsAt) {
          formData.append(
            "sale_ends_at",
            dateTimeLocalToIso(state.saleEndsAt) ?? "",
          );
        }
      }

      // CREATE: bundle variants into the initial POST payload.
      if (!product) {
        if (state.variants.length > 0) {
          formData.append(
            "variants",
            JSON.stringify(
              state.variants.map((v) => ({
                size: v.size.trim() || null,
                color: v.color.trim() || null,
                stock: typeof v.stock === "number" ? v.stock : 0,
              })),
            ),
          );
        }
        const response = await fetch("/api/admin/products", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? "Termék létrehozása sikertelen");
        }
        onOpenChange(false);
        onSaved();
        return;
      }

      // UPDATE: PUT the product itself, then PUT the variants list.
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PUT",
        body: formData,
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Termék frissítése sikertelen");
      }

      // Bulk-upsert variants only if the admin actually edited the list.
      // The bulk-PUT API leaves untouched-but-not-included rows alone, so we
      // intentionally send the full array (no orphans) and rely on a delete
      // sweep elsewhere if rows were removed mid-edit.
      const variantsResponse = await fetch(
        `/api/admin/products/${product.id}/variants`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            variants: state.variants.map((v) => ({
              id: v.id,
              size: v.size.trim() || null,
              color: v.color.trim() || null,
              stock: typeof v.stock === "number" ? v.stock : 0,
            })),
          }),
        },
      );

      if (!variantsResponse.ok) {
        const body = (await variantsResponse.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Variánsok mentése sikertelen");
      }

      // Detect removed variants and DELETE them one-by-one. The bulk PUT
      // doesn't auto-prune.
      const remainingIds = new Set(
        state.variants.map((v) => v.id).filter((id): id is string => Boolean(id)),
      );
      const toDelete = initialVariants.filter((v) => !remainingIds.has(v.id));
      for (const v of toDelete) {
        await fetch(
          `/api/admin/products/${product.id}/variants?variantId=${encodeURIComponent(v.id)}`,
          { method: "DELETE" },
        );
      }

      onOpenChange(false);
      onSaved();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Mentés sikertelen");
    } finally {
      setSubmitting(false);
    }
  }

  const [deletingSale, setDeletingSale] = useState(false);
  async function handleDeleteSale() {
    if (!product) return;
    setDeletingSale(true);
    setServerError(null);
    try {
      const response = await fetch(
        `/api/admin/products/${product.id}/sale`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Akció törlése sikertelen");
      }
      // Local state mirror so the form shows the cleared values without
      // a round-trip through the parent reload.
      setState((s) => ({
        ...s,
        salePrice: "",
        saleStartsAt: "",
        saleEndsAt: "",
      }));
      onSaved();
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Akció törlése sikertelen",
      );
    } finally {
      setDeletingSale(false);
    }
  }

  return (
    <AdminDialogRoot open={open} onOpenChange={onOpenChange}>
      <AdminDialogContent open={open} size="lg">
        <form onSubmit={handleSubmit} noValidate>
          <AdminDialogHeader>
            <AdminDialogTitle>
              {product ? "Termék szerkesztése" : "Új termék"}
            </AdminDialogTitle>
            <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
              {product
                ? "Frissítsd a termék adatait, képét vagy variánsait."
                : "Új termék létrehozása legalább egy variánssal."}
            </p>
          </AdminDialogHeader>

          <AdminDialogBody className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="Név" htmlFor="prod-name" error={errors.name}>
                <AdminInput
                  id="prod-name"
                  value={state.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Pl. Hazai mez 24/25"
                  maxLength={120}
                  required
                />
              </AdminField>

              <AdminField label="Kategória" htmlFor="prod-category">
                <AdminInput
                  id="prod-category"
                  value={state.category}
                  onChange={(e) => update("category", e.target.value)}
                  placeholder="mez, sapka, sál…"
                />
              </AdminField>
            </div>

            <AdminField label="Leírás" htmlFor="prod-desc">
              <AdminTextarea
                id="prod-desc"
                rows={4}
                value={state.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Rövid termékleírás…"
              />
            </AdminField>

            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="Ár (HUF)" htmlFor="prod-price" error={errors.price}>
                <AdminInput
                  id="prod-price"
                  type="number"
                  min={0}
                  step={100}
                  value={state.price}
                  onChange={(e) => update("price", e.target.value)}
                  placeholder="29990"
                  required
                />
              </AdminField>

              {/* On CREATE we use the single-image dropzone — the bulk
                  images endpoint requires a product ID, so the first
                  image is uploaded inline with the product itself and
                  becomes the cover. After save the admin can re-open the
                  editor to add more via the gallery manager below. */}
              {!product ? (
                <AdminField label="Termékkép (cover)">
                  <ImageDropzone
                    file={state.imageFile}
                    existingUrl={null}
                    onFileChange={(f) => update("imageFile", f)}
                  />
                  <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
                    További képeket a termék létrehozása után adhatsz hozzá a
                    galéria-kezelőben.
                  </p>
                </AdminField>
              ) : null}
            </div>

            {/* F32.5 — Multi-image gallery manager. Only meaningful for
                existing products (the POST endpoint needs an ID). The
                cover state from this section overrides
                `products.image_url` via a DB trigger, so the legacy
                listing/cart paths see fresh covers without a refetch. */}
            {product ? (
              <AdminField label="Termékképek">
                <ProductImagesManager productId={product.id} />
              </AdminField>
            ) : null}

            <AdminField label="Variánsok" error={errors.variants}>
              <VariantsEditor
                variants={state.variants}
                onChange={(v) => update("variants", v)}
              />
            </AdminField>

            {/* ---- F29 — Sale section ----
                Three inputs (price + start + end). The status pill at the
                top reads the live state from `saleStatus` so the admin
                always knows whether what they're seeing is "live now",
                "scheduled", or "expired". The "Akció törlése" button hits
                the dedicated DELETE endpoint so the clear is atomic — an
                empty form-submit also clears, but the explicit button is
                the discoverable escape hatch the spec calls for. */}
            <section
              aria-labelledby="sale-section-heading"
              className="rounded-md border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 p-4"
            >
              <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Tag
                    className="h-4 w-4 text-[var(--accent-red)]"
                    aria-hidden
                  />
                  <h3
                    id="sale-section-heading"
                    className="font-display text-sm uppercase tracking-[0.18em] text-[var(--text-primary)]"
                  >
                    Akció
                  </h3>
                  <SaleStatusBadge status={saleStatus} />
                </div>
                {product && state.salePrice.trim() !== "" && (
                  <AdminButton
                    type="button"
                    variant="subtle"
                    size="sm"
                    onClick={() => void handleDeleteSale()}
                    disabled={deletingSale || submitting}
                    className="text-[var(--accent-red)]"
                  >
                    {deletingSale ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Akció törlése
                  </AdminButton>
                )}
              </header>

              <p className="mb-4 text-xs leading-relaxed text-[var(--text-secondary)]">
                Add meg az akciós árat és opcionálisan az időablakot. Ha az
                ár üres, a terméknek nincs akciója. Az akciós árnak az
                alapárnál kisebbnek kell lennie.
              </p>

              <div className="grid gap-4 sm:grid-cols-3">
                <AdminField
                  label="Akciós ár (HUF)"
                  htmlFor="prod-sale-price"
                  error={errors.salePrice}
                >
                  <AdminInput
                    id="prod-sale-price"
                    type="number"
                    min={0}
                    step={100}
                    value={state.salePrice}
                    onChange={(e) => update("salePrice", e.target.value)}
                    placeholder="—"
                  />
                </AdminField>

                <AdminField
                  label="Akció kezdete"
                  htmlFor="prod-sale-start"
                  error={errors.saleStartsAt}
                >
                  <AdminInput
                    id="prod-sale-start"
                    type="datetime-local"
                    value={state.saleStartsAt}
                    onChange={(e) => update("saleStartsAt", e.target.value)}
                    disabled={state.salePrice.trim() === ""}
                  />
                </AdminField>

                <AdminField
                  label="Akció vége"
                  htmlFor="prod-sale-end"
                  error={errors.saleEndsAt}
                >
                  <AdminInput
                    id="prod-sale-end"
                    type="datetime-local"
                    value={state.saleEndsAt}
                    onChange={(e) => update("saleEndsAt", e.target.value)}
                    disabled={state.salePrice.trim() === ""}
                  />
                </AdminField>
              </div>
            </section>

            {serverError ? (
              <div
                role="alert"
                className="rounded-md border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-3 py-2 text-sm text-[var(--accent-red)]"
              >
                {serverError}
              </div>
            ) : null}
          </AdminDialogBody>

          <AdminDialogFooter>
            <AdminButton
              variant="subtle"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Mégse
            </AdminButton>
            <AdminButton variant="primary" type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {product ? "Mentés" : "Létrehozás"}
            </AdminButton>
          </AdminDialogFooter>
        </form>
      </AdminDialogContent>
    </AdminDialogRoot>
  );
}

// ---------------------------------------------------------------------------
// SaleStatusBadge — derived live indicator next to the section header.
// Mirrors the spec lines: "Akció aktív (X napig)" / "Akció ütemezve (X-tól)"
// / "Akció lejárt". `none` returns null so the row stays compact when a
// product has no sale configured.
// ---------------------------------------------------------------------------

function SaleStatusBadge({ status }: { status: SaleStatus }) {
  if (status.kind === "none") return null;

  if (status.kind === "active") {
    return (
      <AdminBadge tone="success">
        Akció aktív ({status.days} napig)
      </AdminBadge>
    );
  }
  if (status.kind === "active-open") {
    return <AdminBadge tone="success">Akció aktív</AdminBadge>;
  }
  if (status.kind === "scheduled") {
    return (
      <AdminBadge tone="warning">
        Akció ütemezve ({status.days} nap múlva)
      </AdminBadge>
    );
  }
  return <AdminBadge tone="danger">Akció lejárt</AdminBadge>;
}
