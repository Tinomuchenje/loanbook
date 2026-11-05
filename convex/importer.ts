import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireManager } from "./lib/auth";
import {
  DEFAULT_TERMS,
  MAX_TERM_MONTHS,
  allocatePayment,
  buildSchedule,
  isValidDate,
  loanPosition,
  normaliseIdNumber,
  quote,
  todayInHarare,
} from "./lib/loanMath";
import { assertIdNumberFree, cleanBorrower } from "./lib/borrowerRules";
import { applyPayment } from "./lib/repaymentRules";
import { loanReference, nextNumber } from "./lib/util";

// ---------- Spreadsheet import (feature 9) ----------

const rowValidator = v.object({
  name: v.string(),
  idNumber: v.string(),
  phone: v.string(),
  address: v.string(),
  employer: v.string(),
  sourceOfFunds: v.string(),
  amountCents: v.number(),
  termMonths: v.number(),
  disbursedOn: v.string(),
  paidToDateCents: v.number(),
});

type Row = typeof rowValidator.type;

const orBlank = (s: string) => (s.trim() ? s : "Not recorded");

async function checkRows(ctx: QueryCtx, rows: Row[]) {
  const today = todayInHarare();
  const seenIds = new Set<string>();
  return await Promise.all(
    rows.map(async (row, index) => {
      const errors: string[] = [];
      const idNumber = normaliseIdNumber(row.idNumber);
      if (!row.name.trim()) errors.push("Name is missing.");
      if (idNumber.length < 5) errors.push("ID number is missing or too short.");
      if (!Number.isInteger(row.amountCents) || row.amountCents <= 0) errors.push("Amount must be above zero.");
      if (!Number.isInteger(row.termMonths) || row.termMonths < 1 || row.termMonths > MAX_TERM_MONTHS)
        errors.push(`Term must be 1 to ${MAX_TERM_MONTHS} months.`);
      if (!isValidDate(row.disbursedOn)) errors.push("Disbursed date must be YYYY-MM-DD.");
      else if (row.disbursedOn > today) errors.push("Disbursed date is in the future.");
      if (!Number.isInteger(row.paidToDateCents) || row.paidToDateCents < 0)
        errors.push("Paid to date can't be negative.");

      const key = `${idNumber}|${row.amountCents}|${row.disbursedOn}`;
      if (seenIds.has(key)) errors.push("This loan appears twice in the file.");
      seenIds.add(key);

      let existingBorrowerId: Id<"borrowers"> | null = null;
      if (idNumber.length >= 5) {
        const existing = await ctx.db
          .query("borrowers")
          .withIndex("by_idNumber", (q) => q.eq("idNumber", idNumber))
          .first();
        if (existing) {
          existingBorrowerId = existing._id;
          const theirLoans = await ctx.db
            .query("loans")
            .withIndex("by_borrower", (q) => q.eq("borrowerId", existing._id))
            .collect();
          if (theirLoans.some((l) => l.imported && l.approvedCents === row.amountCents && l.disbursedOn === row.disbursedOn))
            errors.push("This loan has already been imported.");
        }
      }

      let preview = null;
      if (errors.length === 0) {
        const q = quote(row.amountCents, row.termMonths);
        if (row.paidToDateCents > q.totalRepayableCents) {
          errors.push(`Paid to date is more than the $${(q.totalRepayableCents / 100).toFixed(2)} repayable.`);
        } else {
          const schedule = buildSchedule(row.amountCents, row.termMonths, row.disbursedOn).map((s) => ({
            ...s,
            paidCents: 0,
          }));
          for (const u of allocatePayment(schedule, row.paidToDateCents).updates) u.instalment.paidCents = u.paidCents;
          const p = loanPosition(schedule, today);
          preview = {
            totalRepayableCents: q.totalRepayableCents,
            outstandingCents: p.outstandingCents,
            arrearsCents: p.arrearsCents,
            daysLate: p.daysLate,
          };
        }
      }
      return { index, idNumber, existingBorrowerId, errors, preview };
    }),
  );
}

/** Dry run: checks every row and shows the balance each loan will have, without saving anything. */
export const check = query({
  args: { rows: v.array(rowValidator) },
  handler: async (ctx, { rows }) => {
    await requireManager(ctx);
    return await checkRows(ctx, rows.slice(0, 200));
  },
});

/** Imports all rows, or none if any row has a problem. */
export const run = mutation({
  args: { rows: v.array(rowValidator) },
  handler: async (ctx, { rows }) => {
    const manager = await requireManager(ctx);
    if (rows.length === 0) return { imported: 0, problems: [] };
    if (rows.length > 200) return { imported: 0, problems: [{ index: -1, errors: ["Import at most 200 loans at a time."] }] };
    const checked = await checkRows(ctx, rows);
    const problems = checked.filter((c) => c.errors.length).map((c) => ({ index: c.index, errors: c.errors }));
    if (problems.length) return { imported: 0, problems };

    const today = todayInHarare();
    const createdBorrowers = new Map<string, Id<"borrowers">>();
    for (const [i, row] of rows.entries()) {
      const c = checked[i];
      let borrowerId = c.existingBorrowerId ?? createdBorrowers.get(c.idNumber) ?? null;
      if (!borrowerId) {
        const clean = cleanBorrower({
          name: row.name,
          idNumber: row.idNumber,
          phone: orBlank(row.phone),
          address: orBlank(row.address),
          employer: orBlank(row.employer),
          sourceOfFunds: orBlank(row.sourceOfFunds),
        });
        await assertIdNumberFree(ctx, clean.idNumber);
        borrowerId = await ctx.db.insert("borrowers", { ...clean, createdBy: manager._id });
        createdBorrowers.set(c.idNumber, borrowerId);
      }
      const q = quote(row.amountCents, row.termMonths);
      const loanId = await ctx.db.insert("loans", {
        borrowerId,
        status: "active",
        reference: loanReference(await nextNumber(ctx, "loan")),
        requestedCents: row.amountCents,
        requestedTermMonths: row.termMonths,
        ...DEFAULT_TERMS,
        approvedCents: row.amountCents,
        approvedTermMonths: row.termMonths,
        decidedBy: manager._id,
        decidedAt: Date.now(),
        decisionNote: "Imported from the spreadsheet",
        disbursedOn: row.disbursedOn,
        depositReference: "Imported",
        processingFeeCents: q.processingFeeCents,
        insuranceCents: q.insuranceCents,
        payoutCents: q.payoutCents,
        interestCents: q.interestCents,
        totalRepayableCents: q.totalRepayableCents,
        disbursedBy: manager._id,
        paidCents: 0,
        imported: true,
        createdBy: manager._id,
        submittedAt: Date.now(),
      });
      for (const s of buildSchedule(row.amountCents, row.termMonths, row.disbursedOn)) {
        await ctx.db.insert("instalments", { loanId, ...s, paidCents: 0 });
      }
      if (row.paidToDateCents > 0) {
        const loan = (await ctx.db.get("loans", loanId))!;
        await applyPayment(ctx, loan, {
          amountCents: row.paidToDateCents,
          paidOn: today,
          method: "import",
          reference: "Paid to date, from the spreadsheet",
          recordedBy: manager._id,
        });
      }
    }
    return { imported: rows.length, problems: [] };
  },
});
