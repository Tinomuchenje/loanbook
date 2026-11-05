"use client";

import Link from "next/link";
import { Suspense, useDeferredValue, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Paperclip, Plus, Search } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { MAX_TERM_MONTHS } from "@convex/lib/loanMath";
import { Button, Card, CardHeader, Field, FormError, Input, Loading, PageHeader, Select, Textarea } from "@/components/ui";
import { BorrowerCell } from "@/components/loan-bits";
import { BorrowerDialog } from "@/components/borrower-form";
import { QuotePanel } from "@/components/quote-panel";
import { ACCEPTED_DOCS, checkDocument, useUploadDocument } from "@/components/document-upload";
import { errorMessage, parseMoney } from "@/lib/format";

export default function NewApplicationPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewApplication />
    </Suspense>
  );
}

function NewApplication() {
  const router = useRouter();
  const params = useSearchParams();
  const [borrowerId, setBorrowerId] = useState<Id<"borrowers"> | null>(
    (params.get("borrower") as Id<"borrowers">) || null,
  );
  const [amount, setAmount] = useState("");
  const [term, setTerm] = useState(6);
  const [purpose, setPurpose] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const create = useMutation(api.loans.createApplication);
  const upload = useUploadDocument();
  const amountCents = parseMoney(amount);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!borrowerId) return setError("Choose the borrower first.");
    if (!amountCents) return setError("Enter the amount requested, e.g. 1000 or 1,250.50.");
    const docProblem = checkDocument(file);
    if (docProblem) return setError(docProblem);
    setSaving(true);
    try {
      const documentId = await upload(file!);
      const loanId = await create({
        borrowerId,
        requestedCents: amountCents,
        requestedTermMonths: term,
        purpose,
        documentId,
        documentName: file!.name,
      });
      router.push(`/loans/${loanId}`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/applications" className="hover:underline">Applications</Link>}
        title="New loan application"
        description="Capture the request and attach a supporting document. It goes to the manager for a decision."
      />
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="1. Borrower" />
            <div className="p-5">
              <BorrowerPicker value={borrowerId} onChange={setBorrowerId} />
            </div>
          </Card>
          <Card>
            <CardHeader title="2. Loan requested" sub="10% interest a month on the amount lent, repaid in monthly instalments." />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Amount (USD)" htmlFor="amount" error={amount && !amountCents ? "Enter an amount like 1000 or 1,250.50" : null}>
                <Input
                  id="amount"
                  inputMode="decimal"
                  placeholder="1,000.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="tnum"
                  required
                />
              </Field>
              <Field label="Term" htmlFor="term" hint={`1 to ${MAX_TERM_MONTHS} months`}>
                <Select id="term" value={term} onChange={(e) => setTerm(Number(e.target.value))}>
                  {Array.from({ length: MAX_TERM_MONTHS }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "month" : "months"}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Purpose" htmlFor="purpose" hint="Optional, e.g. school fees or stock" className="sm:col-span-2">
                <Textarea id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2} />
              </Field>
            </div>
          </Card>
          <Card>
            <CardHeader title="3. Supporting document" sub="A recent payslip or bank statement. PDF or photo, up to 10 MB." />
            <div className="p-5">
              <label
                htmlFor="doc"
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line bg-sunk px-4 py-5 text-sm hover:border-brand"
              >
                <Paperclip size={18} className="text-muted" />
                {file ? (
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{file.name}</span>
                    <span className="text-[12.5px] text-muted">{file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`} · click to change</span>
                  </span>
                ) : (
                  <span className="text-muted">Choose a file</span>
                )}
                <input
                  id="doc"
                  type="file"
                  accept={ACCEPTED_DOCS}
                  className="sr-only"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </Card>
        </div>
        <div className="flex flex-col gap-4 lg:sticky lg:top-8 lg:h-fit">
          <Card>
            <CardHeader title="What the borrower gets" />
            <div className="p-5">
              <QuotePanel amountCents={amountCents} termMonths={term} />
              <p className="mt-3 text-[12.5px] text-muted">
                The first instalment falls due one month after the money is deposited. The manager may approve a lower amount or a
                shorter term.
              </p>
            </div>
          </Card>
          <FormError message={error} />
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Submitting…" : "Submit for approval"}
          </Button>
        </div>
      </form>
    </>
  );
}

function BorrowerPicker({ value, onChange }: { value: Id<"borrowers"> | null; onChange: (id: Id<"borrowers"> | null) => void }) {
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search);
  const [adding, setAdding] = useState(false);
  const chosen = useQuery(api.borrowers.get, value ? { borrowerId: value } : "skip");
  const results = useQuery(api.borrowers.list, value ? "skip" : { search: deferred || undefined });

  if (value) {
    if (chosen === undefined) return <Loading />;
    if (chosen === null) return <p className="text-sm text-bad">That borrower no longer exists.</p>;
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BorrowerCell
          name={chosen.borrower.name}
          sub={`ID ${chosen.borrower.idNumber} · ${chosen.borrower.employer} · ${chosen.borrower.sourceOfFunds}`}
        />
        <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Find borrower</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <Input
            type="search"
            placeholder="Search by name or ID number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </label>
        <Button variant="secondary" onClick={() => setAdding(true)}>
          <Plus size={16} /> New borrower
        </Button>
      </div>
      <div className="max-h-72 overflow-y-auto rounded-xl border border-line">
        {results === undefined ? (
          <Loading />
        ) : results.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">No borrowers found. Add them as a new borrower.</p>
        ) : (
          results.map((b) => (
            <button
              key={b._id}
              type="button"
              onClick={() => onChange(b._id)}
              className="flex w-full items-center justify-between gap-3 border-b border-line px-4 py-2.5 text-left last:border-0 hover:bg-sunk"
            >
              <BorrowerCell name={b.name} sub={`ID ${b.idNumber}`} />
              {b.activeLoans > 0 && <span className="text-[12.5px] text-warn">{b.activeLoans} active loan</span>}
            </button>
          ))
        )}
      </div>
      {adding && <BorrowerDialog open onClose={() => setAdding(false)} onSaved={(id) => onChange(id)} />}
    </div>
  );
}
