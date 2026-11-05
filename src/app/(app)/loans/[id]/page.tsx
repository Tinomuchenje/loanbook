"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ExternalLink, FileText, Paperclip } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { MAX_TERM_MONTHS, quote } from "@convex/lib/loanMath";
import {
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  Field,
  FormError,
  Input,
  KeyValue,
  Loading,
  PageHeader,
  Pill,
  Progress,
  Select,
  Table,
  Td,
  Textarea,
  Th,
} from "@/components/ui";
import { LoanPill, METHOD_LABEL, receiptNo } from "@/components/loan-bits";
import { QuotePanel } from "@/components/quote-panel";
import { ACCEPTED_DOCS, checkDocument, useUploadDocument } from "@/components/document-upload";
import { errorMessage, formatDate, formatMoney, formatTimestamp, parseMoney, plural } from "@/lib/format";

type Detail = NonNullable<FunctionReturnType<typeof api.loans.get>>;

export default function LoanPage() {
  const { id } = useParams<{ id: string }>();
  const data = useQuery(api.loans.get, { loanId: id as Id<"loans"> });
  if (data === undefined) return <Loading />;
  if (data === null)
    return <EmptyState title="Loan not found" action={<ButtonLink href="/loans" variant="secondary">Back to loans</ButtonLink>} />;

  const { loan, borrower, position, today } = data;
  const isApplication = ["submitted", "sent_back", "declined", "approved"].includes(loan.status);

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={isApplication ? "/applications" : "/loans"} className="hover:underline">
            {isApplication ? "Applications" : "Loans"}
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {loan.reference}
            <LoanPill status={loan.status} position={position} today={today} />
          </span>
        }
        description={
          borrower && (
            <>
              <Link href={`/borrowers/${borrower._id}`} className="font-medium text-ink hover:underline">
                {borrower.name}
              </Link>{" "}
              · ID {borrower.idNumber} · {borrower.phone}
            </>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <ActionPanel data={data} />
          {data.instalments.length > 0 && <ScheduleCard data={data} />}
          {loan.status !== "submitted" && loan.status !== "sent_back" && loan.status !== "declined" && (
            <PaymentsCard data={data} />
          )}
          {(loan.status === "active" || data.followUps.length > 0) && <FollowUpsCard data={data} />}
        </div>
        <SummaryCard data={data} />
      </div>
    </>
  );
}

// ---------- What can be done next, by status ----------

function ActionPanel({ data }: { data: Detail }) {
  const { loan, viewerRole } = data;
  switch (loan.status) {
    case "submitted":
      return viewerRole === "manager" ? (
        <DecisionPanel data={data} />
      ) : (
        <Notice tone="warn" title="Waiting for the manager's decision">
          The manager will approve, change, send back or decline this application. You&apos;ll see the outcome here.
        </Notice>
      );
    case "sent_back":
      return <ResubmitPanel data={data} />;
    case "declined":
      return (
        <Notice tone="neutral" title={`Declined by ${data.decidedByName ?? "the manager"}`}>
          {loan.decisionNote}
        </Notice>
      );
    case "approved":
      return <DisbursePanel data={data} />;
    case "active":
      return <RecordPaymentPanel data={data} />;
    case "closed":
      return (
        <Notice tone="ok" title={`Paid in full on ${formatDate(loan.closedOn)}`}>
          Every instalment has been paid. No further payments can be recorded on this loan.
        </Notice>
      );
  }
}

function Notice({ tone, title, children }: { tone: "warn" | "ok" | "neutral" | "info"; title: string; children?: ReactNode }) {
  const cls = {
    warn: "border-warn/30 bg-warn-soft",
    ok: "border-ok/25 bg-ok-soft",
    neutral: "border-line bg-sunk",
    info: "border-info/25 bg-info-soft",
  }[tone];
  return (
    <div className={`rounded-card border p-5 ${cls}`}>
      <h2 className="font-semibold">{title}</h2>
      {children && <p className="mt-1 text-sm text-ink/80 [overflow-wrap:anywhere]">{children}</p>}
    </div>
  );
}

function DocumentLink({ data }: { data: Detail }) {
  if (!data.documentUrl) return <span className="text-muted">No document</span>;
  return (
    <a
      href={data.documentUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:border-brand"
    >
      <FileText size={16} className="shrink-0 text-brand" />
      <span className="truncate">{data.loan.documentName ?? "Supporting document"}</span>
      <ExternalLink size={14} className="shrink-0 text-muted" />
    </a>
  );
}

// ---------- Feature 4: manager's decision ----------

function DecisionPanel({ data }: { data: Detail }) {
  const { loan, borrower } = data;
  const decide = useMutation(api.loans.decide);
  const [mode, setMode] = useState<"approve" | "approve_changed" | "send_back" | "decline">("approve");
  const [amount, setAmount] = useState((loan.requestedCents / 100).toFixed(2));
  const [term, setTerm] = useState(loan.requestedTermMonths);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const amountCents = parseMoney(amount);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "approve_changed" && !amountCents) return setError("Enter the amount you're approving.");
    setSaving(true);
    try {
      await decide({
        loanId: loan._id,
        decision: mode,
        approvedCents: mode === "approve_changed" ? amountCents! : undefined,
        approvedTermMonths: mode === "approve_changed" ? term : undefined,
        note,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const options = [
    { key: "approve", label: "Approve as requested" },
    { key: "approve_changed", label: "Approve with changes" },
    { key: "send_back", label: "Send back" },
    { key: "decline", label: "Decline" },
  ] as const;

  return (
    <Card>
      <CardHeader title="Your decision" sub={`Submitted ${formatTimestamp(loan.submittedAt)} by ${data.createdByName}`} />
      <div className="grid gap-5 p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Fact label="Amount requested" value={formatMoney(loan.requestedCents)} />
          <Fact label="Term" value={`${loan.requestedTermMonths} months`} />
          <Fact label="Source of funds" value={borrower?.sourceOfFunds ?? "—"} />
          <Fact label="Employer" value={borrower?.employer ?? "—"} />
          {loan.purpose && <Fact label="Purpose" value={loan.purpose} />}
        </div>
        <div>
          <div className="mb-2 text-[13px] font-medium">Supporting document</div>
          <DocumentLink data={data} />
        </div>
        <form onSubmit={submit} className="grid gap-4 border-t border-line pt-5">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Decision">
            {options.map((o) => (
              <button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={mode === o.key}
                onClick={() => {
                  setMode(o.key);
                  setError(null);
                }}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  mode === o.key
                    ? o.key === "decline"
                      ? "border-bad bg-bad-soft text-bad"
                      : "border-brand bg-brand-soft text-brand"
                    : "border-line text-muted hover:text-ink"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {mode === "approve_changed" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount to approve (USD)" htmlFor="ap-amount" hint={`Up to ${formatMoney(loan.requestedCents)}`}>
                <Input id="ap-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="tnum" />
              </Field>
              <Field label="Term" htmlFor="ap-term" hint={`Up to ${loan.requestedTermMonths} months`}>
                <Select id="ap-term" value={term} onChange={(e) => setTerm(Number(e.target.value))}>
                  {Array.from({ length: loan.requestedTermMonths }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {plural(n, "month")}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          {(mode === "approve" || mode === "approve_changed") && (
            <QuotePanel
              amountCents={mode === "approve" ? loan.requestedCents : amountCents}
              termMonths={mode === "approve" ? loan.requestedTermMonths : term}
            />
          )}
          <Field
            label={mode === "send_back" ? "What needs fixing" : mode === "decline" ? "Reason for declining" : "Note (optional)"}
            htmlFor="dec-note"
            hint={mode === "send_back" ? "The officer sees this and resubmits." : mode === "decline" ? "Kept on the record." : undefined}
          >
            <Textarea id="dec-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </Field>
          <FormError message={error} />
          <div className="flex justify-end">
            <Button type="submit" disabled={saving} variant={mode === "decline" ? "danger" : "primary"}>
              {saving
                ? "Saving…"
                : mode === "approve"
                  ? "Approve"
                  : mode === "approve_changed"
                    ? "Approve with changes"
                    : mode === "send_back"
                      ? "Send back to officer"
                      : "Decline application"}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[12.5px] text-muted">{label}</div>
      <div className="font-medium [overflow-wrap:anywhere]">{value}</div>
    </div>
  );
}

// ---------- Feature 3: fix and resubmit ----------

function ResubmitPanel({ data }: { data: Detail }) {
  const { loan } = data;
  const resubmit = useMutation(api.loans.resubmit);
  const upload = useUploadDocument();
  const [amount, setAmount] = useState((loan.requestedCents / 100).toFixed(2));
  const [term, setTerm] = useState(loan.requestedTermMonths);
  const [purpose, setPurpose] = useState(loan.purpose ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const amountCents = parseMoney(amount);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!amountCents) return setError("Enter the amount requested.");
    if (file) {
      const problem = checkDocument(file);
      if (problem) return setError(problem);
    }
    setSaving(true);
    try {
      const documentId = file ? await upload(file) : undefined;
      await resubmit({
        loanId: loan._id,
        requestedCents: amountCents,
        requestedTermMonths: term,
        purpose,
        documentId,
        documentName: file?.name,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="border-b border-info/20 bg-info-soft px-5 py-4">
        <h2 className="font-semibold">Sent back by {data.decidedByName ?? "the manager"}</h2>
        <p className="mt-1 text-sm [overflow-wrap:anywhere]">{loan.decisionNote}</p>
      </div>
      <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Amount (USD)" htmlFor="rs-amount">
          <Input id="rs-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="tnum" />
        </Field>
        <Field label="Term" htmlFor="rs-term">
          <Select id="rs-term" value={term} onChange={(e) => setTerm(Number(e.target.value))}>
            {Array.from({ length: MAX_TERM_MONTHS }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {plural(n, "month")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Purpose" htmlFor="rs-purpose" className="sm:col-span-2">
          <Textarea id="rs-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2} />
        </Field>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <span className="text-[13px] font-medium">Supporting document</span>
          <div className="flex flex-wrap items-center gap-3">
            <DocumentLink data={data} />
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-brand hover:underline">
              <Paperclip size={15} /> {file ? `Replace with ${file.name}` : "Replace document"}
              <input type="file" accept={ACCEPTED_DOCS} className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>
        <div className="sm:col-span-2">
          <QuotePanel amountCents={amountCents} termMonths={term} />
        </div>
        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Submitting…" : "Resubmit for approval"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ---------- Feature 5: payout ----------

function DisbursePanel({ data }: { data: Detail }) {
  const { loan, today } = data;
  const disburse = useMutation(api.loans.disburse);
  const [date, setDate] = useState(today);
  const [ref, setRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const q = quote(loan.approvedCents!, loan.approvedTermMonths!);
  const changed = loan.approvedCents !== loan.requestedCents || loan.approvedTermMonths !== loan.requestedTermMonths;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await disburse({ loanId: loan._id, disbursedOn: date, depositReference: ref });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Pay out this loan"
        sub={`Approved by ${data.decidedByName} on ${formatTimestamp(loan.decidedAt!)}${changed ? ", with changes" : ""}`}
      />
      <form onSubmit={submit} className="grid gap-5 p-5">
        {loan.decisionNote && <p className="rounded-lg bg-sunk px-3 py-2 text-sm">“{loan.decisionNote}”</p>}
        <div className="rounded-xl bg-navy p-5 text-white">
          <div className="text-[13px] text-navy-muted">Deposit into the borrower&apos;s bank account</div>
          <div className="tnum mt-1 text-3xl font-semibold">{formatMoney(q.payoutCents)}</div>
          <div className="mt-2 text-[13px] text-navy-muted">
            {formatMoney(q.principalCents)} approved, less {formatMoney(q.processingFeeCents)} processing fee and{" "}
            {formatMoney(q.insuranceCents)} insurance
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date deposited" htmlFor="d-date" hint="The first instalment falls due a month after this date.">
            <Input id="d-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Bank reference" htmlFor="d-ref" hint="From the transfer confirmation">
            <Input id="d-ref" value={ref} onChange={(e) => setRef(e.target.value)} required />
          </Field>
        </div>
        <FormError message={error} />
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : `Record payout and create ${plural(loan.approvedTermMonths!, "instalment")}`}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ---------- Feature 6: repayments ----------

function RecordPaymentPanel({ data }: { data: Detail }) {
  const { loan, position, today } = data;
  const record = useMutation(api.repayments.record);
  const suggested = position!.arrearsCents + position!.dueTodayCents || position!.nextDueCents;
  const [amount, setAmount] = useState(suggested ? (suggested / 100).toFixed(2) : "");
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState<"cash" | "direct_debit">("cash");
  const [ref, setRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const amountCents = parseMoney(amount);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    if (!amountCents) return setError("Enter the amount received.");
    setSaving(true);
    try {
      const r = await record({ loanId: loan._id, amountCents, paidOn: date, method, reference: ref });
      setDone(
        r.closed
          ? `Receipt ${receiptNo(r.receiptNumber)}. The loan is now paid in full and closed.`
          : `Receipt ${receiptNo(r.receiptNumber)} saved. ${formatMoney(r.remainingCents)} still owed.`,
      );
      setAmount("");
      setRef("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const shortfall = amountCents && suggested && amountCents < suggested ? suggested - amountCents : 0;

  return (
    <Card>
      <CardHeader
        title="Record a payment"
        sub="Payments fill the oldest unpaid instalment first."
        actions={
          <Button variant="secondary" size="sm" onClick={() => setAmount((position!.outstandingCents / 100).toFixed(2))}>
            Settle in full · {formatMoney(position!.outstandingCents)}
          </Button>
        }
      />
      <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
        <Field
          label="Amount received (USD)"
          htmlFor="p-amount"
          hint={
            shortfall
              ? `Part payment: ${formatMoney(shortfall)} short of what's due now`
              : position!.arrearsCents > 0
                ? `${formatMoney(position!.arrearsCents)} is overdue`
                : position!.nextDueDate
                  ? `Next instalment ${formatMoney(position!.nextDueCents)} on ${formatDate(position!.nextDueDate)}`
                  : undefined
          }
        >
          <Input id="p-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="tnum" />
        </Field>
        <Field label="Date received" htmlFor="p-date">
          <Input id="p-date" type="date" value={date} max={today} min={loan.disbursedOn} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Method" htmlFor="p-method">
          <Select id="p-method" value={method} onChange={(e) => setMethod(e.target.value as "cash" | "direct_debit")}>
            <option value="cash">Cash</option>
            <option value="direct_debit">Direct debit</option>
          </Select>
        </Field>
        <Field label="Reference" htmlFor="p-ref" hint="Optional: debit reference or cash slip number">
          <Input id="p-ref" value={ref} onChange={(e) => setRef(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <FormError message={error} />
          {done && <p className="rounded-lg bg-ok-soft px-3 py-2 text-[13px] text-ok" role="status">{done}</p>}
        </div>
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Record payment"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ---------- Schedule, payments, follow-ups ----------

const INSTALMENT_PILL = {
  paid: <Pill tone="ok">Paid</Pill>,
  late: <Pill tone="bad">Late</Pill>,
  due_today: <Pill tone="warn">Due today</Pill>,
  part_paid: <Pill tone="info">Part paid</Pill>,
  upcoming: <Pill tone="neutral">Upcoming</Pill>,
};

function ScheduleCard({ data }: { data: Detail }) {
  const { position } = data;
  return (
    <Card>
      <CardHeader
        title="Repayment schedule"
        sub={position ? `${position.paidCount} of ${position.instalmentCount} instalments paid` : undefined}
      />
      <Table>
        <thead>
          <tr>
            <Th>#</Th>
            <Th>Due</Th>
            <Th align="right">Instalment</Th>
            <Th align="right">Interest</Th>
            <Th align="right">Paid</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {data.instalments.map((i) => (
            <tr key={i._id} className={i.status === "late" ? "bg-bad-soft/40" : undefined}>
              <Td className="tnum text-muted">{i.number}</Td>
              <Td className="whitespace-nowrap">{formatDate(i.dueDate)}</Td>
              <Td align="right">{formatMoney(i.amountCents)}</Td>
              <Td align="right" className="text-muted">
                {formatMoney(i.interestCents)}
              </Td>
              <Td align="right">
                {i.paidCents > 0 ? formatMoney(i.paidCents) : <span className="text-faint">—</span>}
                {i.paidCents > 0 && i.paidCents < i.amountCents && (
                  <span className="block text-[12px] text-bad">short {formatMoney(i.amountCents - i.paidCents)}</span>
                )}
              </Td>
              <Td>{INSTALMENT_PILL[i.status]}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function PaymentsCard({ data }: { data: Detail }) {
  return (
    <Card>
      <CardHeader title="Payments received" sub={plural(data.repayments.length, "payment")} />
      {data.repayments.length === 0 ? (
        <EmptyState title="No payments yet" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Receipt</Th>
              <Th>Date</Th>
              <Th>Method</Th>
              <Th align="right">Amount</Th>
              <Th>Recorded by</Th>
            </tr>
          </thead>
          <tbody>
            {data.repayments.map((r) => (
              <tr key={r._id}>
                <Td className="whitespace-nowrap font-mono text-[12.5px] text-brand">{receiptNo(r.receiptNumber)}</Td>
                <Td className="whitespace-nowrap">{formatDate(r.paidOn)}</Td>
                <Td>
                  {METHOD_LABEL[r.method]}
                  {r.reference && <span className="block max-w-56 truncate text-[12.5px] text-muted">{r.reference}</span>}
                </Td>
                <Td align="right" className="font-medium">
                  {formatMoney(r.amountCents)}
                </Td>
                <Td className="text-muted">{r.recordedByName}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

function FollowUpsCard({ data }: { data: Detail }) {
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
      await add({ loanId: data.loan._id, note, promisedDate: promised || undefined });
      setNote("");
      setPromised("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Follow-up notes" sub="Calls, visits and promises to pay" />
      {data.loan.status === "active" && (
        <form onSubmit={submit} className="grid gap-3 border-b border-line p-5 sm:grid-cols-[minmax(0,1fr)_170px_auto] sm:items-end">
          <Field label="Note" htmlFor="fu-note">
            <Input id="fu-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Called, will pay on Friday" />
          </Field>
          <Field label="Promised date" htmlFor="fu-date">
            <Input id="fu-date" type="date" value={promised} onChange={(e) => setPromised(e.target.value)} />
          </Field>
          <Button type="submit" variant="secondary" disabled={saving || !note.trim()}>
            Add note
          </Button>
          <div className="sm:col-span-3">
            <FormError message={error} />
          </div>
        </form>
      )}
      {data.followUps.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">No follow-ups logged.</p>
      ) : (
        <ul className="divide-y divide-line">
          {data.followUps.map((f) => (
            <li key={f._id} className="px-5 py-3 text-sm">
              <p className="[overflow-wrap:anywhere]">{f.note}</p>
              <p className="mt-1 text-[12.5px] text-muted">
                {f.createdByName} · {formatTimestamp(f._creationTime)}
                {f.promisedDate && (
                  <span className={f.promisedDate < data.today ? "text-bad" : "text-ink"}>
                    {" "}
                    · promised by {formatDate(f.promisedDate)}
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------- Summary ----------

function SummaryCard({ data }: { data: Detail }) {
  const { loan, position } = data;
  const amount = loan.approvedCents ?? loan.requestedCents;
  const term = loan.approvedTermMonths ?? loan.requestedTermMonths;
  const q = quote(amount, term);
  return (
    <div className="flex flex-col gap-6 lg:sticky lg:top-8 lg:h-fit">
      {position && (
        <Card>
          <div className="flex flex-col gap-3 p-5">
            <div className="text-[13px] text-muted">Still owed</div>
            <div className="tnum text-3xl font-semibold tracking-tight">{formatMoney(position.outstandingCents)}</div>
            <Progress value={position.paidCents / position.totalCents} tone={position.arrearsCents > 0 ? "bad" : "brand"} />
            <div className="tnum text-[13px] text-muted">
              {formatMoney(position.paidCents)} paid of {formatMoney(position.totalCents)}
            </div>
            {position.arrearsCents > 0 && (
              <div className="rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">
                {formatMoney(position.arrearsCents)} overdue, oldest from {formatDate(position.oldestLateDue)} ({position.daysLate} days)
              </div>
            )}
          </div>
        </Card>
      )}
      <Card>
        <CardHeader title="Loan terms" />
        <dl className="divide-y divide-line px-5 py-1">
          <KeyValue label={loan.approvedCents ? "Amount approved" : "Amount requested"} value={formatMoney(amount)} />
          {loan.approvedCents !== undefined && loan.approvedCents !== loan.requestedCents && (
            <KeyValue label="Amount requested" value={formatMoney(loan.requestedCents)} />
          )}
          <KeyValue label="Term" value={plural(term, "month")} />
          <KeyValue label="Interest" value={`${loan.monthlyRateBps / 100}% a month, flat`} />
          <KeyValue label="Total interest" value={formatMoney(loan.interestCents ?? q.interestCents)} />
          <KeyValue label="Total repayable" value={formatMoney(loan.totalRepayableCents ?? q.totalRepayableCents)} />
          <KeyValue label="Processing fee (1%)" value={formatMoney(loan.processingFeeCents ?? q.processingFeeCents)} />
          <KeyValue label="Insurance (0.5%)" value={formatMoney(loan.insuranceCents ?? q.insuranceCents)} />
          <KeyValue label={loan.payoutCents ? "Paid out" : "Will be paid out"} value={formatMoney(loan.payoutCents ?? q.payoutCents)} />
        </dl>
      </Card>
      <Card>
        <CardHeader title="Record" />
        <dl className="divide-y divide-line px-5 py-1 text-sm">
          <KeyValue label="Captured" value={`${formatTimestamp(loan.submittedAt)}, ${data.createdByName}`} />
          {loan.decidedAt && <KeyValue label="Decided" value={`${formatTimestamp(loan.decidedAt)}, ${data.decidedByName}`} />}
          {loan.disbursedOn && <KeyValue label="Deposited" value={formatDate(loan.disbursedOn)} />}
          {loan.depositReference && <KeyValue label="Bank reference" value={loan.depositReference} />}
          {loan.purpose && <KeyValue label="Purpose" value={loan.purpose} />}
          {loan.imported && <KeyValue label="Source" value="Imported from the spreadsheet" />}
        </dl>
        {loan.documentId && (
          <div className="border-t border-line px-5 py-4">
            <DocumentLink data={data} />
          </div>
        )}
      </Card>
    </div>
  );
}
