"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Download, Upload } from "lucide-react";
import { api } from "@convex/_generated/api";
import { isValidDate } from "@convex/lib/loanMath";
import { Button, Card, CardHeader, EmptyState, FormError, Loading, PageHeader, Pill, Table, Td, Th, Textarea, buttonClass } from "@/components/ui";
import { useIsManager } from "@/components/viewer";
import { IMPORT_COLUMNS, IMPORT_TEMPLATE, toImportRows, type ImportRow } from "@/lib/csv";
import { errorMessage, formatDate, formatMoney, plural } from "@/lib/format";

export default function ImportPage() {
  const isManager = useIsManager();
  if (!isManager) return <EmptyState title="Only managers can import loans" />;
  return <Importer />;
}

function Importer() {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const check = useQuery(api.importer.check, rows && rows.length ? { rows } : "skip");
  const run = useMutation(api.importer.run);

  function load(csv: string) {
    setText(csv);
    setResult(null);
    setRunError(null);
    const parsed = toImportRows(csv);
    setParseError(parsed.error);
    setRows(parsed.error ? null : parsed.rows);
  }

  function downloadTemplate() {
    const blob = new Blob([IMPORT_TEMPLATE], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "loan-import-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function doImport() {
    if (!rows) return;
    setRunning(true);
    setRunError(null);
    try {
      const r = await run({ rows });
      if (r.problems.length) {
        setRunError(`Nothing was imported: ${plural(r.problems.length, "row")} still need fixing.`);
      } else {
        setResult(`${plural(r.imported, "loan")} imported. Check each balance against the spreadsheet on the Loans page.`);
        setRows(null);
        setText("");
      }
    } catch (err) {
      setRunError(errorMessage(err));
    } finally {
      setRunning(false);
    }
  }

  const problems = check?.filter((c) => c.errors.length).length ?? 0;
  const totals = check?.reduce(
    (s, c) => ({
      outstanding: s.outstanding + (c.preview?.outstandingCents ?? 0),
      arrears: s.arrears + (c.preview?.arrearsCents ?? 0),
    }),
    { outstanding: 0, arrears: 0 },
  );

  return (
    <>
      <PageHeader
        title="Import from the spreadsheet"
        description="Bring active loans and what's been paid so far into the loan book, then run a month alongside the spreadsheet before retiring it."
      />
      {result && <p className="rounded-card border border-ok/25 bg-ok-soft px-5 py-4 text-sm font-medium text-ok" role="status">{result}</p>}
      <Card>
        <CardHeader
          title="1. Prepare a CSV file"
          sub="One row per loan. Dates as 2026-06-28 or 28/06/2026. Amounts in US dollars."
          actions={
            <Button variant="secondary" size="sm" onClick={downloadTemplate}>
              <Download size={15} /> Download template
            </Button>
          }
        />
        <div className="overflow-x-auto px-5 py-4">
          <code className="block whitespace-nowrap rounded-lg bg-sunk px-3 py-2 font-mono text-[12.5px]">{IMPORT_COLUMNS.join(",")}</code>
          <p className="mt-2 text-[13px] text-muted">
            <strong className="text-ink">paid_to_date</strong> is the total the borrower has repaid so far. It&apos;s applied to the oldest
            instalments first, so arrears show up straight away. Existing borrowers are matched by ID number.
          </p>
        </div>
      </Card>
      <Card>
        <CardHeader
          title="2. Load it"
          actions={
            <label className={buttonClass("secondary", "sm", "cursor-pointer")}>
              <Upload size={15} /> Choose CSV file
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) load(await f.text());
                  e.target.value = "";
                }}
              />
            </label>
          }
        />
        <div className="grid gap-3 p-5">
          <Textarea
            aria-label="CSV contents"
            value={text}
            onChange={(e) => load(e.target.value)}
            rows={6}
            placeholder="Or paste the CSV here"
            className="font-mono text-[12.5px]"
          />
          <FormError message={parseError} />
        </div>
      </Card>
      {rows && (
        <Card>
          <CardHeader
            title="3. Check and import"
            sub={
              check
                ? problems
                  ? `${plural(problems, "row")} to fix before importing`
                  : `${plural(rows.length, "loan")} ready · ${formatMoney(totals!.outstanding)} outstanding · ${formatMoney(totals!.arrears)} overdue`
                : "Checking…"
            }
            actions={
              <Button onClick={doImport} disabled={!check || problems > 0 || running}>
                {running ? "Importing…" : `Import ${plural(rows.length, "loan")}`}
              </Button>
            }
          />
          {runError && (
            <div className="px-5 pt-4">
              <FormError message={runError} />
            </div>
          )}
          {check === undefined ? (
            <Loading label="Checking each row…" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Row</Th>
                  <Th>Borrower</Th>
                  <Th align="right">Amount</Th>
                  <Th>Paid out</Th>
                  <Th align="right">Outstanding</Th>
                  <Th align="right">Overdue</Th>
                  <Th>Check</Th>
                </tr>
              </thead>
              <tbody>
                {check.map((c) => {
                  const r = rows[c.index];
                  return (
                    <tr key={c.index} className={c.errors.length ? "bg-bad-soft/40" : undefined}>
                      <Td className="tnum text-muted">{c.index + 2}</Td>
                      <Td>
                        <span className="font-medium">{r.name || "—"}</span>
                        <span className="block text-[12.5px] text-muted">
                          ID {r.idNumber || "—"}
                          {c.existingBorrowerId ? " · existing borrower" : ""}
                        </span>
                      </Td>
                      <Td align="right">
                        {r.amountCents > 0 ? formatMoney(r.amountCents) : "—"}
                        <span className="block text-[12.5px] text-muted">{r.termMonths || "?"} mo</span>
                      </Td>
                      <Td className="whitespace-nowrap">{isValidDate(r.disbursedOn) ? formatDate(r.disbursedOn) : r.disbursedOn || "—"}</Td>
                      <Td align="right">{c.preview ? formatMoney(c.preview.outstandingCents) : "—"}</Td>
                      <Td align="right">
                        {c.preview ? (
                          c.preview.arrearsCents > 0 ? (
                            <span className="text-bad">
                              {formatMoney(c.preview.arrearsCents)}
                              <span className="block text-[12.5px]">{c.preview.daysLate} days</span>
                            </span>
                          ) : (
                            "—"
                          )
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td>
                        {c.errors.length ? (
                          <ul className="text-[12.5px] text-bad">
                            {c.errors.map((e) => (
                              <li key={e}>{e}</li>
                            ))}
                          </ul>
                        ) : (
                          <Pill tone="ok">Ready</Pill>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      )}
    </>
  );
}
