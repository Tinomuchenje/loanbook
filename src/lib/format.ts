import { ConvexError } from "convex/values";
export { formatMoney, parseMoney } from "@convex/lib/loanMath";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-11-05" → "5 Nov 2026" */
export function formatDate(date: string | null | undefined, opts: { year?: boolean } = {}): string {
  if (!date) return "—";
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}${opts.year === false ? "" : ` ${y}`}`;
}

export function weekday(date: string): string {
  const t = new Date(date + "T00:00:00Z");
  return DAYS[t.getUTCDay()];
}

export function monthName(date: string): string {
  return MONTHS[Number(date.slice(5, 7)) - 1];
}

export function formatTimestamp(ms: number): string {
  const d = new Date(ms + 2 * 3600 * 1000); // Harare
  const date = d.toISOString().slice(0, 10);
  const time = d.toISOString().slice(11, 16);
  return `${formatDate(date)}, ${time}`;
}

export function percent(share: number): string {
  return `${(share * 100).toFixed(share > 0 && share < 0.1 ? 1 : 0)}%`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** The message to show for a failed Convex call. */
export function errorMessage(e: unknown): string {
  if (e instanceof ConvexError) return String(e.data);
  return "That didn't save. Check your connection and try again.";
}

export function plural(n: number, word: string, many = word + "s") {
  return `${n} ${n === 1 ? word : many}`;
}
