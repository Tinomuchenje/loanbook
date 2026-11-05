"use client";

import { quote } from "@convex/lib/loanMath";
import { formatMoney } from "@/lib/format";

/** Live figures for an amount and term: what the borrower receives and what they repay. */
export function QuotePanel({ amountCents, termMonths }: { amountCents: number | null; termMonths: number }) {
  if (!amountCents || termMonths < 1) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-sunk p-4 text-sm text-muted">
        Enter the amount and term to see the payout, fees and monthly instalment.
      </div>
    );
  }
  const q = quote(amountCents, termMonths);
  return (
    <div className="rounded-xl border border-line bg-sunk p-4">
      <div className="grid grid-cols-3 gap-3">
        <Figure label="Monthly instalment" value={formatMoney(q.instalmentCents)} strong />
        <Figure label="Total repayable" value={formatMoney(q.totalRepayableCents)} />
        <Figure label="Borrower receives" value={formatMoney(q.payoutCents)} />
      </div>
      <dl className="mt-3 grid gap-1 border-t border-line pt-3 text-[13px]">
        <Row label={`Interest, 10% a month × ${termMonths}`} value={formatMoney(q.interestCents)} />
        <Row label="Processing fee, 1%, deducted at payout" value={formatMoney(q.processingFeeCents)} />
        <Row label="Loan insurance, 0.5%, deducted at payout" value={formatMoney(q.insuranceCents)} />
      </dl>
    </div>
  );
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[12px] text-muted">{label}</div>
      <div className={`tnum truncate text-lg font-semibold ${strong ? "text-brand" : ""}`}>{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="tnum">{value}</dd>
    </div>
  );
}
