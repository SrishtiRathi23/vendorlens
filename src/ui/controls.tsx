import { type ButtonHTMLAttributes, type ReactNode, useId } from "react";

const BUTTON_STYLE = {
  primary: "bg-forest text-ivory hover:bg-emerald",
  secondary: "border border-forest bg-ivory text-forest hover:bg-sage",
  danger: "bg-brick text-ivory hover:opacity-90",
  quiet: "text-emerald underline underline-offset-4 hover:text-forest",
} as const;

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON_STYLE }) {
  return (
    <button
      type={type}
      data-magnetic={variant === "primary" || variant === "secondary" ? "" : undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_STYLE[variant]} ${className}`}
      {...props}
    />
  );
}

/** Shared input styling: visible border, 44px height, palette focus ring from globals.css. */
export const inputClass =
  "min-h-11 w-full rounded-md border border-charcoal/40 bg-white px-3 py-2 text-base text-charcoal";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: (control: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode;
}

/** Label, hint and error wired to the control with ids, so screen readers announce all three. */
export function Field({ label, hint, error, className = "", children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-forest">
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy, ...(error ? { "aria-invalid": true as const } : {}) })}
      {hint && (
        <p id={hintId} className="text-xs text-charcoal/80">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-brick">
          {error}
        </p>
      )}
    </div>
  );
}

const BADGE_TONE = {
  neutral: "bg-cream text-charcoal",
  good: "bg-sage text-forest",
  warn: "bg-saffron/40 text-charcoal",
  bad: "bg-brick text-ivory",
  info: "bg-forest text-ivory",
} as const;

/** A status label. Meaning is always in the text; colour only reinforces it. */
export function Badge({ tone = "neutral", children }: { tone?: keyof typeof BADGE_TONE; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${BADGE_TONE[tone]}`}>
      {children}
    </span>
  );
}
