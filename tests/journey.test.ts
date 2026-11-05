import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");

const MANAGER = { name: "Grace Manager", email: "grace@lender.co.zw", subject: "clerk|grace" };
const OFFICER = { name: "Tapiwa Officer", email: "tapiwa@lender.co.zw", subject: "clerk|tapiwa" };
const STRANGER = { name: "Someone", email: "someone@else.com", subject: "clerk|stranger" };

const borrower = {
  name: "Rudo Chikwanha",
  idNumber: "63-123456 A 12",
  address: "12 Samora Machel Ave, Harare",
  phone: "+263 77 123 4567",
  employer: "Delta Beverages",
  sourceOfFunds: "Salary",
};

beforeEach(() => {
  vi.useFakeTimers();
  // 10:00 in Harare on Thursday 5 November 2026
  vi.setSystemTime(new Date("2026-11-05T08:00:00Z"));
});
afterEach(() => vi.useRealTimers());

async function setup() {
  const t = convexTest(schema, modules);
  const manager = t.withIdentity(MANAGER);
  const officer = t.withIdentity(OFFICER);
  expect(await manager.mutation(api.users.link, {})).toEqual({ result: "ok" });
  await manager.mutation(api.users.addStaff, { name: OFFICER.name, email: OFFICER.email, role: "officer" });
  expect(await officer.mutation(api.users.link, {})).toEqual({ result: "ok" });
  return { t, manager, officer };
}

async function uploadDoc(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => ctx.storage.store(new Blob(["payslip"], { type: "application/pdf" })));
}

async function approvedLoan(amountCents = 100000, term = 6) {
  const s = await setup();
  const borrowerId = await s.officer.mutation(api.borrowers.create, borrower);
  const documentId = await uploadDoc(s.t);
  const loanId = await s.officer.mutation(api.loans.createApplication, {
    borrowerId,
    requestedCents: amountCents,
    requestedTermMonths: term,
    documentId,
    documentName: "payslip.pdf",
  });
  await s.manager.mutation(api.loans.decide, { loanId, decision: "approve" });
  return { ...s, borrowerId, loanId };
}

describe("sign-in and staff (feature 1)", () => {
  test("first person is manager; strangers are kept out; officers can't manage staff", async () => {
    const { t, officer } = await setup();
    const stranger = t.withIdentity(STRANGER);
    expect(await stranger.mutation(api.users.link, {})).toEqual({ result: "not_invited" });
    expect((await stranger.query(api.users.me, {})).state).toBe("needs_link");
    await expect(stranger.query(api.borrowers.list, {})).rejects.toThrow(/Sign in/);
    await expect(officer.query(api.users.listStaff, {})).rejects.toThrow(/Only a manager/);
    const me = await officer.query(api.users.me, {});
    expect(me.state).toBe("ok");
    expect(me.user?.role).toBe("officer");
  });

  test("a switched-off officer loses access", async () => {
    const { manager, officer } = await setup();
    const staff = await manager.query(api.users.listStaff, {});
    const tapiwa = staff.find((s) => s.email === OFFICER.email)!;
    await manager.mutation(api.users.updateStaff, { userId: tapiwa._id, active: false });
    expect((await officer.query(api.users.me, {})).state).toBe("inactive");
    await expect(officer.query(api.borrowers.list, {})).rejects.toThrow();
  });
});

describe("borrowers (feature 2)", () => {
  test("ID numbers are unique and searchable", async () => {
    const { officer } = await setup();
    await officer.mutation(api.borrowers.create, borrower);
    await expect(
      officer.mutation(api.borrowers.create, { ...borrower, name: "Someone Else", idNumber: "63123456a12" }),
    ).rejects.toThrow(/already belongs to Rudo Chikwanha/);
    const byId = await officer.query(api.borrowers.list, { search: "63-123456-A12" });
    expect(byId.map((b) => b.name)).toEqual(["Rudo Chikwanha"]);
  });

  test("missing fields are rejected", async () => {
    const { officer } = await setup();
    await expect(officer.mutation(api.borrowers.create, { ...borrower, employer: "  " })).rejects.toThrow(
      /Employer is required/,
    );
  });
});

describe("applications and approvals (features 3 and 4)", () => {
  test("only managers decide, and every decision is recorded", async () => {
    const { t, officer, manager } = await setup();
    const borrowerId = await officer.mutation(api.borrowers.create, borrower);
    const documentId = await uploadDoc(t);
    const loanId = await officer.mutation(api.loans.createApplication, {
      borrowerId,
      requestedCents: 200000,
      requestedTermMonths: 12,
      documentId,
      documentName: "payslip.pdf",
    });
    await expect(officer.mutation(api.loans.decide, { loanId, decision: "approve" })).rejects.toThrow(
      /Only a manager/,
    );
    await expect(
      manager.mutation(api.loans.decide, { loanId, decision: "approve_changed", approvedCents: 300000 }),
    ).rejects.toThrow(/not raise/);
    await expect(manager.mutation(api.loans.decide, { loanId, decision: "send_back" })).rejects.toThrow(
      /needs to fix/,
    );
    await manager.mutation(api.loans.decide, {
      loanId,
      decision: "send_back",
      note: "Payslip is from 2025, need a recent one",
    });
    await officer.mutation(api.loans.resubmit, {
      loanId,
      requestedCents: 200000,
      requestedTermMonths: 12,
      documentId: await uploadDoc(t),
      documentName: "payslip-oct-2026.pdf",
    });
    await manager.mutation(api.loans.decide, {
      loanId,
      decision: "approve_changed",
      approvedCents: 150000,
      approvedTermMonths: 6,
      note: "Lower amount for a first loan",
    });
    const detail = (await officer.query(api.loans.get, { loanId }))!;
    expect(detail.loan.status).toBe("approved");
    expect(detail.loan.approvedCents).toBe(150000);
    expect(detail.decidedByName).toBe(MANAGER.name);
    expect(detail.loan.decidedAt).toBeTypeOf("number");
    expect(detail.documentUrl).toBeTruthy();
    await expect(manager.mutation(api.loans.decide, { loanId, decision: "decline", note: "x" })).rejects.toThrow(
      /already been decided/,
    );
  });

  test("terms outside 1 to 24 months are refused", async () => {
    const { t, officer } = await setup();
    const borrowerId = await officer.mutation(api.borrowers.create, borrower);
    await expect(
      officer.mutation(api.loans.createApplication, {
        borrowerId,
        requestedCents: 100000,
        requestedTermMonths: 25,
        documentId: await uploadDoc(t),
        documentName: "p.pdf",
      }),
    ).rejects.toThrow(/between 1 and 24/);
  });

  test("application counts feed the approval tiles", async () => {
    const { officer, loanId, manager } = await approvedLoan();
    const list = await manager.query(api.loans.listApplications, {});
    expect(list.counts.approved).toBe(1);
    expect(list.rows[0]._id).toBe(loanId);
    expect((await officer.query(api.loans.listApplications, { status: "submitted" })).rows).toHaveLength(0);
  });
});

describe("payout, schedule and repayments (features 5 and 6)", () => {
  test("schedule matches the brief's worked example to the cent", async () => {
    const { officer, loanId } = await approvedLoan(100000, 6);
    await expect(
      officer.mutation(api.loans.disburse, { loanId, disbursedOn: "2026-12-01", depositReference: "X" }),
    ).rejects.toThrow(/future/);
    await officer.mutation(api.loans.disburse, {
      loanId,
      disbursedOn: "2026-05-05",
      depositReference: "CBZ TRF 88123",
    });
    const d = (await officer.query(api.loans.get, { loanId }))!;
    expect(d.loan.status).toBe("active");
    expect(d.loan.payoutCents).toBe(98500);
    expect(d.loan.processingFeeCents).toBe(1000);
    expect(d.loan.insuranceCents).toBe(500);
    expect(d.loan.totalRepayableCents).toBe(160000);
    expect(d.instalments.map((i) => i.amountCents)).toEqual([26667, 26667, 26667, 26667, 26667, 26665]);
    expect(d.instalments.map((i) => i.dueDate)).toEqual([
      "2026-06-05",
      "2026-07-05",
      "2026-08-05",
      "2026-09-05",
      "2026-10-05",
      "2026-11-05",
    ]);
  });

  test("payments fill the oldest instalment, show arrears, and settling closes the loan", async () => {
    const { officer, manager, loanId } = await approvedLoan(100000, 6);
    await officer.mutation(api.loans.disburse, { loanId, disbursedOn: "2026-05-05", depositReference: "T1" });

    for (const paidOn of ["2026-06-05", "2026-07-04", "2026-08-06"]) {
      await officer.mutation(api.repayments.record, { loanId, amountCents: 26667, paidOn, method: "cash" });
    }
    const r = await officer.mutation(api.repayments.record, {
      loanId,
      amountCents: 10000,
      paidOn: "2026-10-10",
      method: "direct_debit",
      reference: "DD 445",
    });
    expect(r.receiptNumber).toBe(4);
    expect(r.closed).toBe(false);

    let d = (await officer.query(api.loans.get, { loanId }))!;
    expect(d.instalments.map((i) => i.status)).toEqual(["paid", "paid", "paid", "late", "late", "due_today"]);
    expect(d.instalments[3].paidCents).toBe(10000);
    expect(d.position!.arrearsCents).toBe(16667 + 26667);
    expect(d.position!.daysLate).toBe(61); // 5 Sep to 5 Nov
    expect(d.position!.dueTodayCents).toBe(26665);

    const arrears = await officer.query(api.arrears.list, {});
    expect(arrears.rows).toHaveLength(1);
    expect(arrears.rows[0].arrearsCents).toBe(43334);
    await officer.mutation(api.arrears.addFollowUp, {
      loanId,
      note: "Called. Will pay at month end.",
      promisedDate: "2026-11-30",
    });
    expect((await officer.query(api.arrears.list, {})).rows[0].lastFollowUp?.promisedDate).toBe("2026-11-30");

    const dash = await manager.query(api.dashboard.summary, {});
    expect(dash.outstandingCents).toBe(160000 - 26667 * 3 - 10000);
    expect(dash.arrearsCents).toBe(43334);
    expect(dash.loansInArrears).toBe(1);
    expect(dash.dueTodayCents).toBe(26665);
    expect(dash.collectedThisMonth).toBe(0);
    expect(dash.collectedLastMonth).toBe(10000);

    await expect(
      officer.mutation(api.repayments.record, { loanId, amountCents: 999999, paidOn: "2026-11-05", method: "cash" }),
    ).rejects.toThrow(/more than the \$699.99 still owed/);

    const settle = await officer.mutation(api.repayments.record, {
      loanId,
      amountCents: 69999,
      paidOn: "2026-11-05",
      method: "cash",
    });
    expect(settle.closed).toBe(true);
    d = (await officer.query(api.loans.get, { loanId }))!;
    expect(d.loan.status).toBe("closed");
    expect(d.loan.closedOn).toBe("2026-11-05");
    expect(d.loan.paidCents).toBe(160000);
    await expect(
      officer.mutation(api.repayments.record, { loanId, amountCents: 100, paidOn: "2026-11-05", method: "cash" }),
    ).rejects.toThrow(/active loans/);

    const recent = await officer.query(api.repayments.listRecent, { onlyToday: true });
    expect(recent.rows.map((x) => x.amountCents)).toEqual([69999]);
    expect((await manager.query(api.dashboard.summary, {})).collectedToday).toBe(69999);
  });
});

describe("spreadsheet import (feature 9)", () => {
  const rows = [
    {
      name: "Kuda Mhlanga",
      idNumber: "08-765432 K 08",
      phone: "+263 73 116 8840",
      address: "",
      employer: "Self-employed",
      sourceOfFunds: "Farming",
      amountCents: 200000,
      termMonths: 5,
      disbursedOn: "2026-06-28",
      paidToDateCents: 100000,
    },
    {
      ...borrower,
      amountCents: 80000,
      termMonths: 4,
      disbursedOn: "2026-08-01",
      paidToDateCents: 0,
    },
  ];

  test("checks rows, imports all-or-nothing, and refuses a second import", async () => {
    const { manager, officer } = await setup();
    await expect(officer.mutation(api.importer.run, { rows })).rejects.toThrow(/Only a manager/);

    const bad = await manager.mutation(api.importer.run, {
      rows: [rows[0], { ...rows[1], termMonths: 30 }],
    });
    expect(bad.imported).toBe(0);
    expect(bad.problems[0].index).toBe(1);
    expect((await manager.query(api.borrowers.list, {})).length).toBe(0);

    const preview = await manager.query(api.importer.check, { rows });
    // Kuda: $2,000 x 5 months at 10% = $3,000 total, $600 a month. Paid $1,000.
    expect(preview[0].preview).toEqual({
      totalRepayableCents: 300000,
      outstandingCents: 200000,
      arrearsCents: 140000, // due Jul 28 to Oct 28 = $2,400, paid $1,000, so $1,400 late
      daysLate: 69, // the 28 Aug instalment is only part paid: 28 Aug to 5 Nov
    });

    const ok = await manager.mutation(api.importer.run, { rows });
    expect(ok).toEqual({ imported: 2, problems: [] });
    const loans = await manager.query(api.loans.listLoans, { filter: "all" });
    expect(loans.rows).toHaveLength(2);
    const kuda = loans.rows.find((l) => l.borrowerName === "Kuda Mhlanga")!;
    expect(kuda.position.outstandingCents).toBe(200000);

    const again = await manager.mutation(api.importer.run, { rows });
    expect(again.imported).toBe(0);
    expect(again.problems.map((p) => p.errors[0])).toEqual([
      "This loan has already been imported.",
      "This loan has already been imported.",
    ]);
    // Opening balances don't count as money collected this month.
    expect((await manager.query(api.dashboard.summary, {})).collectedThisMonth).toBe(0);
  });
});
