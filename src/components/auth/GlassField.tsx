"use client";

import { forwardRef, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface GlassFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Visible label text (Hungarian). */
  label: string;
  /** Native input type — `password` triggers the reveal toggle. */
  type?: "email" | "password" | "text";
  /** Inline validation / server error rendered under the field. */
  error?: string | null;
  /** Helper text shown when there is no error. */
  hint?: string;
}

/**
 * Liquid-glass input with a top-anchored static label and a focused
 * gold underline that "ignites" on focus.
 *
 * Why not floating labels: floating labels look great empty but make
 * autofill state ambiguous (the browser overrides our text colour).
 * Top labels are clearer and pair better with the editorial feel of
 * the auth shell.
 *
 * Password fields get an inline reveal toggle. Email fields display
 * an autocomplete-friendly inputmode.
 */
export const GlassField = forwardRef<HTMLInputElement, GlassFieldProps>(
  function GlassField(
    { label, type = "text", error, hint, className, id, ...rest },
    ref,
  ) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    const [revealed, setRevealed] = useState(false);
    const isPassword = type === "password";
    const effectiveType = isPassword && revealed ? "text" : type;

    const describedBy = error ? errorId : hint ? hintId : undefined;

    return (
      <div className="space-y-1.5">
        <label
          htmlFor={inputId}
          className="text-text-secondary block text-xs font-medium uppercase tracking-[0.14em]"
        >
          {label}
        </label>

        <div className="group relative">
          <input
            ref={ref}
            id={inputId}
            type={effectiveType}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy}
            inputMode={type === "email" ? "email" : undefined}
            autoCapitalize={type === "email" ? "none" : undefined}
            spellCheck={type === "email" ? false : undefined}
            className={cn(
              // base
              "h-11 w-full bg-transparent px-3 pr-10 text-[15px]",
              "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
              "rounded-md border border-[var(--glass-border)]",
              "transition-[border-color,background-color,box-shadow] duration-200",
              "focus:outline-none",
              // glass fill — comes from below the border so the focus ring still reads
              "bg-[var(--glass-bg)] hover:bg-[var(--glass-bg-hover)]",
              // focus state — gold hairline + soft halo
              "focus:border-[var(--accent-gold)]",
              "focus:shadow-[0_0_0_3px_rgba(245,158,11,0.12)]",
              // error state
              error &&
                "border-[var(--accent-red)] focus:border-[var(--accent-red)] focus:shadow-[0_0_0_3px_rgba(220,38,38,0.18)]",
              // autofill: kill Chrome's yellow box and keep our text colour
              "[&:-webkit-autofill]:[transition:background-color_9999s_ease-in-out_0s] [&:-webkit-autofill]:[-webkit-text-fill-color:var(--text-primary)]",
              className,
            )}
            {...rest}
          />

          {isPassword && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? "Jelszó elrejtése" : "Jelszó megjelenítése"}
              className={cn(
                "absolute top-1/2 right-2 -translate-y-1/2",
                "inline-flex h-7 w-7 items-center justify-center rounded-md",
                "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                "transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
              )}
              tabIndex={-1}
            >
              {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>

        {/* Error takes precedence; hint is a fallback */}
        {error ? (
          <p
            id={errorId}
            role="alert"
            className="text-[12.5px] font-medium text-[var(--accent-red)]"
          >
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-text-muted text-[12.5px]">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
