"use client";

import clsx from "clsx";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { CheckCircle2, Clock, FileText, Plus, RotateCcw, XCircle } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { ButtonLink, Card, EmptyState, Loading, PageHeader, Table, Td, Th } from "@/components/ui";
import { BorrowerCell, LoanPill } from "@/components/loan-bits";
import { useIsManager } from "@/components/viewer";
import { formatMoney, formatTimestamp } from "@/lib/format";

type Status = Doc<"loans">["status"];
type Filter = "all" | "submitted" | "sent_back" | "approved" | "declined";

export default function ApplicationsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Applications />
    </Suspense>
  );
}

function Applications() {
  const isManager = useIsManager();
  const router = useRouter();
  const params = useSearchParams();
  const filter = (params.get("status") as Filter) || "all";
  const data = useQuery(api.loans.listApplications, filter === "all" ? {} : { status: filter as Status });

  const setFilter = (f: Filter) => router.replace(f === "all" ? "/applications" : `/applications?status=${f}`);

  const tiles: { key: Filter; label: string; icon: typeof FileText; tone: string }[] = [
    { key: "all", label: "All applications", icon: FileText, tone: "text-ink" },
    { key: "submitted", label: "Waiting for approval", icon: Clock, tone: "text-warn" },
    { key: "sent_back", label: "Sent back", icon: RotateCcw, tone: "text-info" },
    { key: "approved", label: "Approved, to pay out", icon: CheckCircle2, tone: "text-brand" },
    { key: "declined", label: "Declined", icon: XCircle, tone: "text-muted" },
  ];

  return (
    <>
      <PageHeader
        title={isManager ? "Approvals" : "Applications"}
        description={
          isManager
            ? "Applications waiting for your decision, and where every other application stands."
            : "Applications you and other officers have captured. Approved loans are paid out from the loan page."
        }
        actions={
          <ButtonLink href="/applications/new">
            <Plus size={16} /> New application
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map((t) => {
          const Icon = t.icon;
          const count = data ? (t.key === "all" ? data.total : data.counts[t.key] ?? 0) : null;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              aria-pressed={filter === t.key}
              className={clsx(
                "flex flex-col items-start gap-3 rounded-card border bg-surface p-4 text-left transition-colors",
                filter === t.key ? "border-brand ring-2 ring-brand/15" : "border-line hover:border-faint",
              )}
            >
              <Icon size={20} className={t.tone} strokeWidth={1.75} />
              <span className="text-[13px] text-muted">{t.label}</span>
              <span className="tnum text-2xl font-semibold">{count ?? "–"}</span>
            </button>
          );
        })}
      </div>

      <Card>
        {data === undefined ? (
          <Loading />
        ) : data.rows.length === 0 ? (
          <EmptyState
            title={filter === "submitted" ? "Nothing waiting for approval" : "No applications here"}
            action={filter === "all" ? <ButtonLink href="/applications/new">Capture an application</ButtonLink> : undefined}
          >
            {filter === "all" ? "Applications appear here once an officer captures them." : undefined}
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Borrower</Th>
                <Th>Reference</Th>
                <Th align="right">Amount</Th>
                <Th align="right">Term</Th>
                <Th>Submitted</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const changed =
                  r.approvedCents !== undefined &&
                  (r.approvedCents !== r.requestedCents || r.approvedTermMonths !== r.requestedTermMonths);
                return (
                  <tr key={r._id} className="cursor-pointer hover:bg-sunk/60" onClick={() => router.push(`/loans/${r._id}`)}>
                    <Td>
                      <BorrowerCell name={r.borrowerName} sub={`ID ${r.borrowerIdNumber}`} />
                    </Td>
                    <Td className="whitespace-nowrap font-medium text-brand">{r.reference}</Td>
                    <Td align="right">
                      {changed ? (
                        <>
                          <span className="font-medium">{formatMoney(r.approvedCents!)}</span>
                          <span className="block text-[12px] text-muted line-through">{formatMoney(r.requestedCents)}</span>
                        </>
                      ) : (
                        <span className="font-medium">{formatMoney(r.requestedCents)}</span>
                      )}
                    </Td>
                    <Td align="right">{changed ? r.approvedTermMonths : r.requestedTermMonths} mo</Td>
                    <Td className="whitespace-nowrap">
                      {formatTimestamp(r.submittedAt)}
                      <span className="block text-[12.5px] text-muted">by {r.createdByName}</span>
                    </Td>
                    <Td>
                      <LoanPill status={r.status} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
