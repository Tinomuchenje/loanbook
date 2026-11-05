import { describe, expect, test } from "vitest";
import {
  addMonths,
  allocatePayment,
  buildSchedule,
  daysBetween,
  formatMoney,
  instalmentStatus,
  loanPosition,
  normaliseIdNumber,
  parseMoney,
  quote,
  todayInHarare,
} from "../convex/lib/loanMath";

describe("quote", () => {
  test("matches the brief's worked example: $1,000 over 6 months", () => {
    const q = quote(100000, 6);
    expect(q.processingFeeCents).toBe(1000); // $10
    expect(q.insuranceCents).toBe(500); // $5
    expect(q.payoutCents).toBe(98500); // $985
    expect(q.interestCents).toBe(60000); // $600
    expect(q.totalRepayableCents).toBe(160000); // $1,600
    expect(q.instalmentCents).toBe(26667); // $266.67
  });

  test("24 months costs 240% interest", () => {
    const q = quote(100000, 24);
    expect(q.interestCents).toBe(240000);
    expect(q.totalRepayableCents).toBe(340000);
    expect(q.instalmentCents).toBe(14167);
  });

  test("fees round to the cent", () => {
    const q = quote(33333, 3); // $333.33
    expect(q.processingFeeCents).toBe(333);
    expect(q.insuranceCents).toBe(167);
    expect(q.payoutCents).toBe(33333 - 333 - 167);
  });
});

describe("buildSchedule", () => {
  test("six instalments, last one absorbs rounding", () => {
    const rows = buildSchedule(100000, 6, "2026-11-05");
    expect(rows).toHaveLength(6);
    expect(rows.slice(0, 5).every((r) => r.amountCents === 26667)).toBe(true);
    expect(rows[5].amountCents).toBe(26665);
    expect(rows.reduce((s, r) => s + r.amountCents, 0)).toBe(160000);
    expect(rows.reduce((s, r) => s + r.interestCents, 0)).toBe(60000);
    expect(rows[0].dueDate).toBe("2026-12-05");
    expect(rows[5].dueDate).toBe("2027-05-05");
  });

  test("month-end deposits clamp to the last day of short months", () => {
    const rows = buildSchedule(50000, 3, "2027-01-31");
    expect(rows.map((r) => r.dueDate)).toEqual(["2027-02-28", "2027-03-31", "2027-04-30"]);
  });

  test("every term from 1 to 24 adds up exactly", () => {
    for (let n = 1; n <= 24; n++) {
      const q = quote(123457, n);
      const rows = buildSchedule(123457, n, "2026-01-15");
      expect(rows.reduce((s, r) => s + r.amountCents, 0)).toBe(q.totalRepayableCents);
      expect(rows.reduce((s, r) => s + r.interestCents, 0)).toBe(q.interestCents);
    }
  });
});

describe("dates", () => {
  test("addMonths across a year end and a leap year", () => {
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
  });
  test("daysBetween", () => {
    expect(daysBetween("2026-10-01", "2026-11-04")).toBe(34);
  });
  test("today in Harare rolls over at 22:00 UTC", () => {
    expect(todayInHarare(Date.parse("2026-11-04T21:59:00Z"))).toBe("2026-11-04");
    expect(todayInHarare(Date.parse("2026-11-04T22:00:00Z"))).toBe("2026-11-05");
  });
});

describe("allocatePayment", () => {
  const sched = () =>
    buildSchedule(100000, 3, "2026-08-01").map((r) => ({ ...r, paidCents: 0 }));

  test("fills the oldest instalment first and carries the rest", () => {
    const rows = sched(); // 3 x 43333/43334
    const { updates, leftoverCents } = allocatePayment(rows, 50000);
    expect(updates.map((u) => [u.instalment.number, u.paidCents])).toEqual([
      [1, 43333],
      [2, 6667],
    ]);
    expect(leftoverCents).toBe(0);
  });

  test("reports money beyond the balance as leftover", () => {
    const rows = sched();
    const total = rows.reduce((s, r) => s + r.amountCents, 0);
    const { leftoverCents } = allocatePayment(rows, total + 500);
    expect(leftoverCents).toBe(500);
  });
});

describe("loanPosition", () => {
  test("arrears, days late and next due", () => {
    const rows = buildSchedule(80000, 4, "2026-08-01").map((r) => ({ ...r, paidCents: 0 }));
    // Due 1 Sep, 1 Oct, 1 Nov, 1 Dec; $280 each ($1,120 total). Paid $280 + $140.
    rows[0].paidCents = 28000;
    rows[1].paidCents = 14000;
    const p = loanPosition(rows, "2026-11-04");
    expect(p.arrearsCents).toBe(14000 + 28000);
    expect(p.oldestLateDue).toBe("2026-10-01");
    expect(p.daysLate).toBe(34);
    expect(p.nextDueDate).toBe("2026-12-01");
    expect(p.outstandingCents).toBe(112000 - 42000);
    expect(p.paidCount).toBe(1);
  });

  test("statuses", () => {
    const i = { number: 1, dueDate: "2026-11-04", amountCents: 100, paidCents: 0 };
    expect(instalmentStatus(i, "2026-11-04")).toBe("due_today");
    expect(instalmentStatus(i, "2026-11-05")).toBe("late");
    expect(instalmentStatus({ ...i, paidCents: 50 }, "2026-11-01")).toBe("part_paid");
    expect(instalmentStatus({ ...i, paidCents: 100 }, "2026-12-01")).toBe("paid");
  });
});

describe("helpers", () => {
  test("parseMoney", () => {
    expect(parseMoney("1,000")).toBe(100000);
    expect(parseMoney("$266.67")).toBe(26667);
    expect(parseMoney("0")).toBeNull();
    expect(parseMoney("12.345")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });
  test("formatMoney", () => {
    expect(formatMoney(160000)).toBe("$1,600.00");
    expect(formatMoney(98500, { decimals: false })).toBe("$985");
  });
  test("normaliseIdNumber", () => {
    expect(normaliseIdNumber("63-123456 a 12")).toBe("63123456A12");
  });
});
