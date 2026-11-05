"use client";

import Link from "next/link";
import type { Doc } from "@convex/_generated/dataModel";
import { Avatar, Pill, type Tone } from "./ui";
import { formatDate, formatMoney, plural } from "@/lib/format";

type Status = Doc<"loans">["status"];

export const STATUS_LABEL: Record<Status, string> = {
  submitted: "Waiting for approval",
  sent_back: "Sent back",
  declined: "Declined",
  approved: "Approved, not paid out",
  active: "Active",
  closed: "Closed",
};

const STATUS_TONE: Record<Status, Tone> = {
  submitted: "warn",
  sent_back: "info",
  declined: "neutral",
  approved: "brand",
  active: "brand",
  closed: "ok",
};

export type Position = {
  arrearsCents: number;
  daysLate: number;
  nextDueDate: string | null;
  nextDueCents: number;
  outstandingCents: number;
  dueTodayCents: number;
};

/** One pill that says where a loan stands, including lateness for active loans. */
export function LoanPill({ status, position, today }: { status: Status; position?: Position | null; today?: string }) {
  if (status === "active" && position) {
    if (position.arrearsCents > 0) return <Pill tone="bad">{position.daysLate} days late</Pill>;
    if (position.dueTodayCents > 0 || (today && position.nextDueDate === today)) return <Pill tone="warn">Due today</Pill>;
    return <Pill tone="brand">Up to date</Pill>;
  }
  return <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>;
}

export function NextDue({ position, today }: { position: Position; today: string }) {
  if (position.outstandingCents <= 0) return <span className="text-muted">Paid in full</span>;
  if (position.arrearsCents > 0)
    return (
      <span>
        <span className="tnum font-medium text-bad">{formatMoney(position.arrearsCents)}</span>
        <span className="block text-[12.5px] text-muted">overdue</span>
      </span>
    );
  if (!position.nextDueDate) return <span className="text-muted">—</span>;
  const days = Math.round((Date.parse(position.nextDueDate) - Date.parse(today)) / 86400000);
  return (
    <span>
      <span className="tnum font-medium">{formatMoney(position.nextDueCents)}</span>
      <span className="block text-[12.5px] text-muted">
        {days === 0 ? "due today" : days === 1 ? "due tomorrow" : `due ${formatDate(position.nextDueDate, { year: false })} · in ${plural(days, "day")}`}
      </span>
    </span>
  );
}

export function BorrowerCell({ name, sub, href }: { name: string; sub?: string; href?: string }) {
  const inner = (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar name={name} />
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink">{name}</span>
        {sub && <span className="block truncate text-[12.5px] text-muted">{sub}</span>}
      </span>
    </span>
  );
  return href ? (
    <Link href={href} className="hover:underline">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export const METHOD_LABEL = { cash: "Cash", direct_debit: "Direct debit", import: "Opening balance" } as const;

export function receiptNo(n: number) {
  return `No. ${String(n).padStart(5, "0")}`;
}
