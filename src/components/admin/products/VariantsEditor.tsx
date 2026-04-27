"use client";

import { Plus, Trash2 } from "lucide-react";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminInput } from "@/components/admin/AdminInput";

export interface VariantDraft {
  /** Defined for existing variants (PUT-able), absent for newly added rows. */
  id?: string;
  size: string;
  color: string;
  stock: number | "";
  /** Local-only key — separate from `id` so brand-new rows still re-render
   *  predictably when the array shifts. */
  _key: string;
}

interface VariantsEditorProps {
  variants: VariantDraft[];
  onChange: (next: VariantDraft[]) => void;
}

let _variantKeyCounter = 0;
function makeKey(): string {
  _variantKeyCounter += 1;
  return `v_${Date.now()}_${_variantKeyCounter}`;
}

export function makeEmptyVariant(): VariantDraft {
  return { size: "", color: "", stock: 0, _key: makeKey() };
}

export function VariantsEditor({ variants, onChange }: VariantsEditorProps) {
  function update(index: number, patch: Partial<VariantDraft>) {
    onChange(variants.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  function remove(index: number) {
    onChange(variants.filter((_, i) => i !== index));
  }

  function add() {
    onChange([...variants, makeEmptyVariant()]);
  }

  return (
    <div className="space-y-3">
      {variants.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 py-6 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            Nincs még variáns. Adj hozzá legalább egyet, hogy a termék
            megjelenjen a boltban.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-[var(--glass-border)] bg-[var(--bg-primary)]">
          <table className="w-full border-collapse text-sm">
            <thead className="border-b border-[var(--glass-border)] bg-[var(--bg-tertiary)]/40">
              <tr>
                <th className="h-9 px-3 text-left font-display text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                  Méret
                </th>
                <th className="h-9 px-3 text-left font-display text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                  Szín
                </th>
                <th className="h-9 px-3 text-left font-display text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                  Készlet
                </th>
                <th className="h-9 w-[60px] px-3" />
              </tr>
            </thead>
            <tbody>
              {variants.map((v, i) => (
                <tr
                  key={v._key}
                  className="border-b border-[var(--glass-border)] last:border-0"
                >
                  <td className="px-3 py-2">
                    <AdminInput
                      value={v.size}
                      onChange={(e) => update(i, { size: e.target.value })}
                      placeholder="S, M, L, XL…"
                      className="h-8"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <AdminInput
                      value={v.color}
                      onChange={(e) => update(i, { color: e.target.value })}
                      placeholder="Blaugrana, fekete…"
                      className="h-8"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <AdminInput
                      type="number"
                      min={0}
                      step={1}
                      value={v.stock === "" ? "" : v.stock}
                      onChange={(e) =>
                        update(i, {
                          stock:
                            e.target.value === ""
                              ? ""
                              : Math.max(0, Number.parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="h-8 w-24"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <AdminButton
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(i)}
                      aria-label="Variáns törlése"
                      className="text-[var(--accent-red)] hover:bg-[var(--accent-red)]/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </AdminButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminButton type="button" variant="subtle" size="sm" onClick={add}>
        <Plus className="h-4 w-4" />
        Variáns hozzáadása
      </AdminButton>
    </div>
  );
}
