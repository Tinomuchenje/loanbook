"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Card, EmptyState, FilterTabs, Loading, PageHeader, Progress, Table, Td, Th } from "@/components/ui";
import { BorrowerCell, LoanPill, NextDue } from "@/components/loan-bits";
import { formatDate, formatMoney } from "@/lib/format";

type Filter = "active" | "late" | "closed" | "all";

export default function LoansPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Loans />
    </Suspense>
  );
}

function Loans() {
  const router = useRouter();
  const params = useSearchParams();
  const filter = (params.get("show") as Filter) || "active";
  const data = useQuery(api.loans.listLoans, { filter });

  return (
    <>
      <PageHeader title="Loans" description="Loans that have been paid out, with what's still owed and when the next instalment falls due." />
      <Card>
        <div className="border-b border-line p-4">
          <FilterTabs<Filter>
            value={filter}
            onChange={(f) => router.replace(f === "active" ? "/loans" : `/loans?show=${f}`)}
            options={[
              { value: "active", label: "Active" },
              { value: "late", label: "In arrears" },
              { value: "closed", label: "Closed" },
              { value: "all", label: "All" },
            ]}
          />
        </div>
        {data === undefined ? (
          <Loading />
        ) : data.rows.length === 0 ? (
          <EmptyState title={filter === "late" ? "No loans in arrears" : "No loans here yet"}>
            {filter === "active" ? "Loans appear here once an approved application is paid out." : undefined}
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Borrower</Th>
                <Th align="right">Amount</Th>
                <Th>Repaid</Th>
                <Th align="right">Outstanding</Th>
                <Th>Next instalment</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r._id} className="cursor-pointer hover:bg-sunk/60" onClick={() => router.push(`/loans/${r._id}`)}>
                  <Td>
                    <BorrowerCell name={r.borrowerName} sub={`${r.reference} · ${r.borrowerPhone}`} />
                  </Td>
                  <Td align="right">
                    <span className="font-medium">{formatMoney(r.approvedCents)}</span>
                    <span className="block text-[12.5px] text-muted">
                      {r.termMonths} mo · {formatDate(r.disbursedOn)}
                    </span>
                  </Td>
                  <Td className="min-w-36">
                    <Progress
                      value={r.position.totalCents ? r.position.paidCents / r.position.totalCents : 0}
                      tone={r.status === "closed" ? "ok" : r.position.arrearsCents > 0 ? "bad" : "brand"}
                    />
                    <span className="mt-1 block text-[12.5px] text-muted">
                      {r.position.paidCount} of {r.position.instalmentCount} instalments
                    </span>
                  </Td>
                  <Td align="right" className="font-medium">
                    {formatMoney(r.position.outstandingCents)}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {r.status === "closed" ? (
                      <span className="text-muted">Closed {formatDate(r.closedOn)}</span>
                    ) : (
                      <NextDue position={r.position} today={data.today} />
                    )}
                  </Td>
                  <Td>
                    <LoanPill status={r.status} position={r.position} today={data.today} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
