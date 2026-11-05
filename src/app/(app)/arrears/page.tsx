"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { Button, Card, Dialog, EmptyState, Field, FormError, Input, Loading, PageHeader, Pill, Table, Td, Th, Textarea } from "@/components/ui";
import { BorrowerCell } from "@/components/loan-bits";
import { errorMessage, formatDate, formatMoney, formatTimestamp, plural } from "@/lib/format";

type Row = FunctionReturnType<typeof api.arrears.list>["rows"][number];

function lateTone(days: number) {
  return days > 60 ? "bad" : days > 30 ? "bad" : "warn";
}

export default function ArrearsPage() {
  const data = useQuery(api.arrears.list, {});
  const [logging, setLogging] = useState<Row | null>(null);

  return (
    <>
      <PageHeader
        title="Arrears"
        description="Loans with an instalment past its due date, longest overdue first. Call, log what was agreed, and record the payment when it comes in."
      />
      {data === undefined ? (
        <Loading />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Summary label="Total overdue" value={formatMoney(data.totalArrearsCents)} tone="bad" />
            <Summary label="Loans behind" value={String(data.rows.length)} />
            <Summary
              label="More than 30 days late"
              value={String(data.rows.filter((r) => r.daysLate > 30).length)}
            />
          </div>
          <Card>
            {data.rows.length === 0 ? (
              <EmptyState title="Nobody is behind">Every active loan is up to date as of {formatDate(data.today)}.</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Borrower</Th>
                    <Th align="right">Overdue</Th>
                    <Th>Late since</Th>
                    <Th>Last follow-up</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.loanId} className="hover:bg-sunk/60">
                      <Td>
                        <Link href={`/loans/${r.loanId}`} className="hover:underline">
                          <BorrowerCell name={r.borrowerName} sub={`${r.reference} · ${r.borrowerPhone}`} />
                        </Link>
                      </Td>
                      <Td align="right">
                        <span className="font-semibold text-bad">{formatMoney(r.arrearsCents)}</span>
                        <span className="block text-[12.5px] text-muted">of {formatMoney(r.outstandingCents)} owed</span>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <Pill tone={lateTone(r.daysLate)}>{plural(r.daysLate, "day")}</Pill>
                        <span className="mt-1 block text-[12.5px] text-muted">due {formatDate(r.oldestLateDue)}</span>
                      </Td>
                      <Td className="max-w-72">
                        {r.lastFollowUp ? (
                          <>
                            <span className="line-clamp-2 [overflow-wrap:anywhere]">{r.lastFollowUp.note}</span>
                            <span className="block text-[12.5px] text-muted">
                              {formatTimestamp(r.lastFollowUp.at)}
                              {r.lastFollowUp.promisedDate && (
                                <span className={r.lastFollowUp.promisedDate < data.today ? "text-bad" : ""}>
                                  {" "}
                                  · promised {formatDate(r.lastFollowUp.promisedDate)}
                                </span>
                              )}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted">None yet</span>
                        )}
                      </Td>
                      <Td align="right">
                        <Button variant="secondary" size="sm" onClick={() => setLogging(r)}>
                          Log follow-up
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      )}
      {logging && <FollowUpDialog row={logging} onClose={() => setLogging(null)} />}
    </>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <div className="text-[13px] text-muted">{label}</div>
      <div className={`tnum mt-1 text-2xl font-semibold ${tone === "bad" ? "text-bad" : ""}`}>{value}</div>
    </div>
  );
}

function FollowUpDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const add = useMutation(api.arrears.addFollowUp);
  const [note, setNote] = useState("");
  const [promised, setPromised] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await add({ loanId: row.loanId, note, promisedDate: promised || undefined });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Follow up with ${row.borrowerName}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="fu-form" disabled={saving || !note.trim()}>
            {saving ? "Saving…" : "Save note"}
          </Button>
        </>
      }
    >
      <form id="fu-form" onSubmit={submit} className="grid gap-4">
        <p className="rounded-lg bg-sunk px-3 py-2 text-sm">
          <span className="font-medium">{formatMoney(row.arrearsCents)}</span> overdue, {plural(row.daysLate, "day")} late.
          Phone: <span className="select-all font-medium">{row.borrowerPhone}</span>
        </p>
        <Field label="What happened" htmlFor="fu-note">
          <Textarea id="fu-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Called at 10:00, will pay half on Friday" />
        </Field>
        <Field label="Promised to pay by" htmlFor="fu-date" hint="Optional">
          <Input id="fu-date" type="date" value={promised} onChange={(e) => setPromised(e.target.value)} />
        </Field>
        <FormError message={error} />
      </form>
    </Dialog>
  );
}
