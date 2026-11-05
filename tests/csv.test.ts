import { expect, test } from "vitest";
import { IMPORT_TEMPLATE, normaliseDate, parseCsv, toImportRows } from "../src/lib/csv";

test("parses quoted fields and CRLF", () => {
  expect(parseCsv('a,"b, c","d ""e"""\r\n1,2,3\r\n')).toEqual([
    ["a", "b, c", 'd "e"'],
    ["1", "2", "3"],
  ]);
});

test("normalises day-first dates", () => {
  expect(normaliseDate("28/06/2026")).toBe("2026-06-28");
  expect(normaliseDate("1-7-2026")).toBe("2026-07-01");
  expect(normaliseDate("2026-06-28")).toBe("2026-06-28");
});

test("the template imports cleanly", () => {
  const { rows, error } = toImportRows(IMPORT_TEMPLATE);
  expect(error).toBeNull();
  expect(rows[0]).toMatchObject({
    name: "Kuda Mhlanga",
    idNumber: "08765432K08",
    address: "14 Cecil Ave, Mutare",
    amountCents: 200000,
    termMonths: 5,
    disbursedOn: "2026-06-28",
    paidToDateCents: 100000,
  });
});

test("reports missing columns", () => {
  expect(toImportRows("name,amount\nA,1").error).toMatch(/Missing columns: id_number/);
});
