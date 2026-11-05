"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { ChevronDown } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Card, CardHeader, EmptyState, Loading, Pill, Table, Td, Th, buttonClass } from "./ui";
import { BorrowerCell, METHOD_LABEL, receiptNo } from "./loan-bits";
import { formatDate, formatMoney } from "@/lib/format";

/** Recent repayments, with a "Show only today" switch and Load more, as in the MicroFin reference. */
export function RepaymentsCard({ title = "Recent repayments", pageSize = 10, viewAllHref }: { title?: string; pageSize?: number; viewAllHref?: string }) {
  const [onlyToday, setOnlyToday] = useState(false);
  const [limit, setLimit] = useState(pageSize);
  const data = useQuery(api.repayments.listRecent, { onlyToday, limit });

  return (
    <Card>
      <CardHeader
        title={title}
        actions={
          <>
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
              Show only today
              <button
                type="button"
                role="switch"
                aria-checked={onlyToday}
                onClick={() => setOnlyToday((v) => !v)}
                className={`relative h-6 w-10 rounded-full transition-colors ${onlyToday ? "bg-brand" : "bg-line"}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${onlyToday ? "left-[18px]" : "left-0.5"}`}
                />
              </button>
            </label>
            {viewAllHref && (
              <Link href={viewAllHref} className={buttonClass("secondary", "sm")}>
                View all
              </Link>
            )}
          </>
        }
      />
      {data === undefined ? (
        <Loading />
      ) : data.rows.length === 0 ? (
        <EmptyState title={onlyToday ? "No payments recorded today" : "No payments recorded yet"}>
          Payments appear here as officers record them on a loan.
        </EmptyState>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Borrower</Th>
                <Th>Loan</Th>
                <Th align="right">Amount</Th>
                <Th>Paid on</Th>
                <Th>Method</Th>
                <Th>Receipt</Th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r._id} className="hover:bg-sunk/60">
                  <Td>
                    <BorrowerCell name={r.borrowerName} sub={`ID ${r.borrowerIdNumber}`} />
                  </Td>
                  <Td>
                    <Link href={`/loans/${r.loanId}`} className="whitespace-nowrap font-medium text-brand hover:underline">
                      {r.loanReference}
                    </Link>
                    <span className="block whitespace-nowrap text-[12.5px] text-muted">{r.termMonths} months</span>
                  </Td>
                  <Td align="right" className="font-medium">
                    {formatMoney(r.amountCents)}
                  </Td>
                  <Td className="whitespace-nowrap">{formatDate(r.paidOn)}</Td>
                  <Td>
                    <span className="block">{METHOD_LABEL[r.method]}</span>
                    {r.reference && <span className="block max-w-48 truncate text-[12.5px] text-muted">{r.reference}</span>}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <span className="tnum font-mono text-[12.5px] text-muted">{receiptNo(r.receiptNumber)}</span>
                    {r.loanStatus === "closed" && (
                      <span className="ml-2">
                        <Pill tone="ok">Loan closed</Pill>
                      </span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {data.rows.length >= limit && (
            <div className="flex justify-center border-t border-line py-3">
              <button type="button" className={buttonClass("ghost", "sm")} onClick={() => setLimit((l) => l + pageSize)}>
                Load {pageSize} more <ChevronDown size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
