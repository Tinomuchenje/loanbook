"use client";

import clsx from "clsx";
import Link from "next/link";
import { X } from "lucide-react";
import {
  forwardRef,
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { initials } from "@/lib/format";

// ---------- Buttons ----------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";
const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong",
  secondary: "bg-surface text-ink border border-line hover:border-faint",
  ghost: "text-muted hover:text-ink hover:bg-sunk",
  danger: "bg-surface text-bad border border-bad/30 hover:bg-bad-soft",
};
const buttonSizes = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm" };

export function buttonClass(variant: ButtonVariant = "primary", size: "sm" | "md" = "md", extra?: string) {
  return clsx(buttonBase, buttonVariants[variant], buttonSizes[size], extra);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

// ---------- Layout ----------

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-[13px] text-muted">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={clsx("rounded-card border border-line bg-surface", className)}>{children}</section>;
}

export function CardHeader({ title, actions, sub }: { title: ReactNode; actions?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      {children && <p className="max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-10 text-sm text-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand" />
      {label}
    </div>
  );
}

// ---------- Forms ----------

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[12.5px] text-bad">{error}</p>
      ) : hint ? (
        <p className="text-[12.5px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const inputClass =
  "h-10 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={clsx(inputClass, className)} {...props} />;
});

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx(inputClass, "pr-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(inputClass, "h-auto min-h-20 py-2", className)} {...props} />;
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">
      {message}
    </p>
  );
}

// ---------- Status ----------

export type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "brand";
const toneClass: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
  brand: "bg-brand-soft text-brand",
  neutral: "bg-sunk text-muted border border-line",
};

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold",
        toneClass[tone],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

const avatarTones = [
  "bg-brand-soft text-brand",
  "bg-info-soft text-info",
  "bg-warn-soft text-warn",
  "bg-[#f3e8fb] text-[#7b3fb0]",
  "bg-[#fde8f0] text-[#b53a6a]",
];

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const tone = avatarTones[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % avatarTones.length];
  return (
    <span
      className={clsx("inline-grid shrink-0 place-items-center rounded-full text-[12px] font-semibold", tone)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function Progress({ value, tone = "brand" }: { value: number; tone?: "brand" | "bad" | "ok" | "bright" }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  const bar = { brand: "bg-brand", bad: "bg-bad", ok: "bg-ok", bright: "bg-brand-bright" }[tone];
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-line/70">
      <span className={clsx("block h-full rounded-full", bar)} style={{ width: `${pct}%` }} />
    </span>
  );
}

// ---------- Filters ----------

export function FilterTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
            value === o.value ? "bg-ink text-white" : "text-muted hover:bg-sunk hover:text-ink",
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="tnum ml-1.5 opacity-70">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------- Tables ----------

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, align = "left" }: { children?: ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className={clsx(
        "whitespace-nowrap border-b border-line bg-sunk px-4 py-2.5 text-[12px] font-semibold text-muted",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className,
}: {
  children?: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={clsx(
        "border-b border-line px-4 py-3 align-middle",
        align === "right" && "tnum text-right",
        className,
      )}
    >
      {children}
    </td>
  );
}

// ---------- Dialog ----------

export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-navy/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          "flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-card bg-surface shadow-xl",
          wide ? "max-w-2xl" : "max-w-lg",
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-sunk hover:text-ink"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- Key figures ----------

export function KeyValue({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: "bad" | "ok";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className={clsx("tnum text-right font-medium", tone === "bad" && "text-bad", tone === "ok" && "text-ok")}>
        {value}
      </dd>
    </div>
  );
}
