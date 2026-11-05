"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery } from "convex/react";
import { Pencil, Plus } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Avatar, Button, ButtonLink, Card, CardHeader, EmptyState, Loading, PageHeader } from "@/components/ui";
import { LoanPill, NextDue } from "@/components/loan-bits";
import { BorrowerDialog } from "@/components/borrower-form";
import { formatDate, formatMoney } from "@/lib/format";

export default function BorrowerPage() {
  const { id } = useParams<{ id: string }>();
  const data = useQuery(api.borrowers.get, { borrowerId: id as Id<"borrowers"> });
  const [editing, setEditing] = useState(false);

  if (data === undefined) return <Loading />;
  if (data === null) return <EmptyState title="Borrower not found" action={<ButtonLink href="/borrowers" variant="secondary">Back to borrowers</ButtonLink>} />;
  const { borrower, loans, today } = data;

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/borrowers" className="hover:underline">Borrowers</Link>}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={borrower.name} size={44} />
            {borrower.name}
          </span>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil size={15} /> Edit details
            </Button>
            <ButtonLink href={`/applications/new?borrower=${borrower._id}`}>
              <Plus size={16} /> New application
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader title="Details" />
          <dl className="divide-y divide-line px-5 py-2 text-sm">
            {[
              ["National ID", borrower.idNumber],
              ["Phone", borrower.phone],
              ["Address", borrower.address],
              ["Employer", borrower.employer],
              ["Source of funds", borrower.sourceOfFunds],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5 py-2.5">
                <dt className="text-[12.5px] text-muted">{k}</dt>
                <dd className="font-medium [overflow-wrap:anywhere]">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <h2 className="text-[15px] font-semibold">Loans</h2>
          {loans.length === 0 ? (
            <Card>
              <EmptyState
                title="No loans yet"
                action={<ButtonLink href={`/applications/new?borrower=${borrower._id}`}>Capture an application</ButtonLink>}
              />
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {loans.map((loan) => (
                <Link
                  key={loan._id}
                  href={`/loans/${loan._id}`}
                  className="flex flex-col rounded-card border border-line bg-surface transition-colors hover:border-faint"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
                    <span className="font-semibold">{loan.reference}</span>
                    <LoanPill status={loan.status} position={loan.position} today={today} />
                  </div>
                  <div className="flex items-end justify-between gap-4 px-5 py-4">
                    <div>
                      <div className="tnum text-xl font-semibold text-brand">
                        {formatMoney(loan.approvedCents ?? loan.requestedCents)}
                      </div>
                      <div className="text-[12.5px] text-muted">
                        {loan.approvedTermMonths ?? loan.requestedTermMonths} months
                        {loan.disbursedOn ? ` · paid out ${formatDate(loan.disbursedOn)}` : ""}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      {loan.position && loan.status === "active" ? (
                        <NextDue position={loan.position} today={today} />
                      ) : loan.status === "closed" ? (
                        <span className="text-muted">Closed {formatDate(loan.closedOn)}</span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      {editing && <BorrowerDialog open existing={borrower} onClose={() => setEditing(false)} />}
    </>
  );
}
