import { normaliseIdNumber, parseMoney } from "@convex/lib/loanMath";

/** Minimal CSV parser: commas, quoted fields with "" escapes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

export const IMPORT_COLUMNS = [
  "name",
  "id_number",
  "phone",
  "address",
  "employer",
  "source_of_funds",
  "amount",
  "term_months",
  "disbursed_on",
  "paid_to_date",
] as const;

export const IMPORT_TEMPLATE =
  IMPORT_COLUMNS.join(",") +
  "\n" +
  'Kuda Mhlanga,08-765432 K 08,+263 73 116 8840,"14 Cecil Ave, Mutare",Self-employed,Farming,2000,5,2026-06-28,1000\n';

/** Accepts 2026-06-28, 28/06/2026 or 28-06-2026. Returns YYYY-MM-DD or the input unchanged. */
export function normaliseDate(input: string): string {
  const s = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return s;
}

export type ImportRow = {
  name: string;
  idNumber: string;
  phone: string;
  address: string;
  employer: string;
  sourceOfFunds: string;
  amountCents: number;
  termMonths: number;
  disbursedOn: string;
  paidToDateCents: number;
};

/** Turns CSV text into rows for the importer, or explains what's wrong with the header. */
export function toImportRows(text: string): { rows: ImportRow[]; error: string | null } {
  const table = parseCsv(text.replace(/^\uFEFF/, ""));
  if (table.length < 2) return { rows: [], error: "The file needs a header row and at least one loan." };
  const header = table[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const missing = IMPORT_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) return { rows: [], error: `Missing columns: ${missing.join(", ")}. Use the template.` };
  const col = (r: string[], name: (typeof IMPORT_COLUMNS)[number]) => (r[header.indexOf(name)] ?? "").trim();
  const money = (s: string) => (s.trim() === "" || s.trim() === "0" ? 0 : parseMoney(s) ?? -1);
  const rows = table.slice(1).map((r) => ({
    name: col(r, "name"),
    idNumber: normaliseIdNumber(col(r, "id_number")),
    phone: col(r, "phone"),
    address: col(r, "address"),
    employer: col(r, "employer"),
    sourceOfFunds: col(r, "source_of_funds"),
    amountCents: money(col(r, "amount")),
    termMonths: Number(col(r, "term_months")),
    disbursedOn: normaliseDate(col(r, "disbursed_on")),
    paidToDateCents: money(col(r, "paid_to_date")),
  }));
  if (rows.length > 200) return { rows: [], error: "Import at most 200 loans at a time. Split the file." };
  return { rows, error: null };
}
