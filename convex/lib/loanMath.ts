/**
 * Loan maths. Pure functions, no Convex imports, shared by the backend and the screens.
 *
 * Rules from the brief:
 * - Flat interest: 10% a month on the amount lent, for every month of the term.
 * - Term: 1 to 24 monthly instalments.
 * - 1% processing fee and 0.5% insurance, charged once and deducted from the payout.
 * - First instalment falls due one month after the deposit date.
 * - Payments fill the oldest unpaid instalment first.
 * - An instalment is late the day after its due date if not fully paid.
 *
 * All money is whole cents. All dates are "YYYY-MM-DD" strings.
 */

export const DEFAULT_TERMS = {
  monthlyRateBps: 1000, // 10% a month
  processingFeeBps: 100, // 1%
  insuranceBps: 50, // 0.5%
} as const;

export const MIN_TERM_MONTHS = 1;
export const MAX_TERM_MONTHS = 24;

export type Terms = {
  monthlyRateBps: number;
  processingFeeBps: number;
  insuranceBps: number;
};

export type PlannedInstalment = {
  number: number;
  dueDate: string;
  amountCents: number;
  interestCents: number;
};

/** Percentage of an amount in basis points, rounded half up to the cent. */
export function bpsOf(amountCents: number, bps: number): number {
  return Math.round((amountCents * bps) / 10000);
}

export function quote(principalCents: number, termMonths: number, terms: Terms = DEFAULT_TERMS) {
  const interestCents = Math.round((principalCents * terms.monthlyRateBps * termMonths) / 10000);
  const totalRepayableCents = principalCents + interestCents;
  const processingFeeCents = bpsOf(principalCents, terms.processingFeeBps);
  const insuranceCents = bpsOf(principalCents, terms.insuranceBps);
  const payoutCents = principalCents - processingFeeCents - insuranceCents;
  const instalmentCents = Math.round(totalRepayableCents / termMonths);
  return {
    principalCents,
    termMonths,
    interestCents,
    totalRepayableCents,
    processingFeeCents,
    insuranceCents,
    payoutCents,
    instalmentCents,
  };
}

/** Adds whole months to a YYYY-MM-DD date, clamping to the last day of shorter months. */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(from + "T00:00:00Z");
  const b = Date.parse(to + "T00:00:00Z");
  return Math.round((b - a) / 86400000);
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const t = Date.parse(date + "T00:00:00Z");
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === date;
}

/** Today's date in Harare (UTC+2, no daylight saving). */
export function todayInHarare(now: number = Date.now()): string {
  return new Date(now + 2 * 3600 * 1000).toISOString().slice(0, 10);
}

/** The repayment schedule. Rounding differences land on the last instalment. */
export function buildSchedule(
  principalCents: number,
  termMonths: number,
  disbursedOn: string,
  terms: Terms = DEFAULT_TERMS,
): PlannedInstalment[] {
  const q = quote(principalCents, termMonths, terms);
  const perInterest = Math.round(q.interestCents / termMonths);
  const rows: PlannedInstalment[] = [];
  for (let i = 1; i <= termMonths; i++) {
    const last = i === termMonths;
    rows.push({
      number: i,
      dueDate: addMonths(disbursedOn, i),
      amountCents: last ? q.totalRepayableCents - q.instalmentCents * (termMonths - 1) : q.instalmentCents,
      interestCents: last ? q.interestCents - perInterest * (termMonths - 1) : perInterest,
    });
  }
  return rows;
}

export type InstalmentState = {
  number: number;
  dueDate: string;
  amountCents: number;
  paidCents: number;
};

/**
 * Spreads a payment over the instalments, oldest first.
 * Returns the new paid amount for every instalment it touched, and anything left over.
 */
export function allocatePayment<T extends InstalmentState>(instalments: T[], amountCents: number) {
  let remaining = amountCents;
  const updates: { instalment: T; paidCents: number }[] = [];
  for (const inst of [...instalments].sort((a, b) => a.number - b.number)) {
    if (remaining <= 0) break;
    const owed = inst.amountCents - inst.paidCents;
    if (owed <= 0) continue;
    const take = Math.min(owed, remaining);
    updates.push({ instalment: inst, paidCents: inst.paidCents + take });
    remaining -= take;
  }
  return { updates, leftoverCents: remaining };
}

export type InstalmentStatus = "paid" | "late" | "due_today" | "part_paid" | "upcoming";

export function instalmentStatus(inst: InstalmentState, today: string): InstalmentStatus {
  if (inst.paidCents >= inst.amountCents) return "paid";
  if (inst.dueDate < today) return "late";
  if (inst.dueDate === today) return "due_today";
  return inst.paidCents > 0 ? "part_paid" : "upcoming";
}

/** Where a loan stands today: what's overdue, how late, and what's next. */
export function loanPosition(instalments: InstalmentState[], today: string) {
  const sorted = [...instalments].sort((a, b) => a.number - b.number);
  let totalCents = 0;
  let paidCents = 0;
  let arrearsCents = 0;
  let oldestLateDue: string | null = null;
  let next: InstalmentState | null = null;
  let paidCount = 0;
  let dueTodayCents = 0;
  for (const inst of sorted) {
    totalCents += inst.amountCents;
    paidCents += inst.paidCents;
    const owed = inst.amountCents - inst.paidCents;
    if (owed <= 0) {
      paidCount++;
      continue;
    }
    if (inst.dueDate < today) {
      arrearsCents += owed;
      if (!oldestLateDue) oldestLateDue = inst.dueDate;
    } else {
      if (inst.dueDate === today) dueTodayCents += owed;
      if (!next) next = inst;
    }
  }
  return {
    totalCents,
    paidCents,
    outstandingCents: totalCents - paidCents,
    arrearsCents,
    daysLate: oldestLateDue ? daysBetween(oldestLateDue, today) : 0,
    oldestLateDue,
    nextDueDate: next?.dueDate ?? null,
    nextDueCents: next ? next.amountCents - next.paidCents : 0,
    dueTodayCents,
    paidCount,
    instalmentCount: sorted.length,
  };
}

/** Parses "1,234.56" or "1234" into cents. Returns null when it isn't a positive amount. */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[\s,$]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  return cents > 0 ? cents : null;
}

export function formatMoney(cents: number, opts: { decimals?: boolean } = {}): string {
  const decimals = opts.decimals ?? true;
  const sign = cents < 0 ? "-" : "";
  const value = Math.abs(cents) / 100;
  return (
    sign +
    "$" +
    value.toLocaleString("en-US", {
      minimumFractionDigits: decimals ? 2 : 0,
      maximumFractionDigits: decimals ? 2 : 0,
    })
  );
}

export function normaliseIdNumber(id: string): string {
  return id.toUpperCase().replace(/[\s-]/g, "");
}
