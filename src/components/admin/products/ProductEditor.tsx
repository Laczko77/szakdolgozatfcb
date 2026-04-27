"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import type { Product, ProductVariant } from "@/types/database";
import { AdminButton } from "@/components/admin/AdminButton";
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
}

const EMPTY: FormState = {
  name: "",
  description: "",
  category: "",
  price: "",
  imageFile: null,
  removeExistingImage: false,
  variants: [],
};

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
    setErrors(next);
    return Object.keys(next).length === 0;
  }

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

              <AdminField label="Termékkép">
                <ImageDropzone
                  file={state.imageFile}
                  existingUrl={
                    state.removeExistingImage
                      ? null
                      : product?.image_url ?? null
                  }
                  onFileChange={(f) => update("imageFile", f)}
                  onRemoveExisting={() => update("removeExistingImage", true)}
                />
              </AdminField>
            </div>

            <AdminField label="Variánsok" error={errors.variants}>
              <VariantsEditor
                variants={state.variants}
                onChange={(v) => update("variants", v)}
              />
            </AdminField>

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
