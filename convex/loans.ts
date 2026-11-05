import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireManager, requireUser } from "./lib/auth";
import { loanReference, nextNumber, optional, required } from "./lib/util";
import {
  DEFAULT_TERMS,
  MAX_TERM_MONTHS,
  MIN_TERM_MONTHS,
  buildSchedule,
  instalmentStatus,
  isValidDate,
  loanPosition,
  quote,
  todayInHarare,
} from "./lib/loanMath";
import { borrowerMap, instalmentsFor, userNames } from "./lib/loanData";
import { loanStatusValidator } from "./schema";

function checkAmountAndTerm(amountCents: number, termMonths: number) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new ConvexError("Enter an amount greater than zero.");
  }
  if (amountCents > 100_000_000_00) throw new ConvexError("That amount is too large.");
  if (!Number.isInteger(termMonths) || termMonths < MIN_TERM_MONTHS || termMonths > MAX_TERM_MONTHS) {
    throw new ConvexError(`The term must be between ${MIN_TERM_MONTHS} and ${MAX_TERM_MONTHS} months.`);
  }
}

// ---------- Applications (feature 3) ----------

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const createApplication = mutation({
  args: {
    borrowerId: v.id("borrowers"),
    requestedCents: v.number(),
    requestedTermMonths: v.number(),
    purpose: v.optional(v.string()),
    documentId: v.id("_storage"),
    documentName: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const borrower = await ctx.db.get("borrowers", args.borrowerId);
    if (!borrower) throw new ConvexError("Borrower not found.");
    checkAmountAndTerm(args.requestedCents, args.requestedTermMonths);
    const reference = loanReference(await nextNumber(ctx, "loan"));
    return await ctx.db.insert("loans", {
      borrowerId: args.borrowerId,
      status: "submitted",
      reference,
      requestedCents: args.requestedCents,
      requestedTermMonths: args.requestedTermMonths,
      purpose: optional(args.purpose),
      documentId: args.documentId,
      documentName: required(args.documentName, "Document name"),
      ...DEFAULT_TERMS,
      paidCents: 0,
      createdBy: user._id,
      submittedAt: Date.now(),
    });
  },
});

/** Officer fixes an application the manager sent back, and submits it again. */
export const resubmit = mutation({
  args: {
    loanId: v.id("loans"),
    requestedCents: v.number(),
    requestedTermMonths: v.number(),
    purpose: v.optional(v.string()),
    documentId: v.optional(v.id("_storage")),
    documentName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const loan = await ctx.db.get("loans", args.loanId);
    if (!loan) throw new ConvexError("Application not found.");
    if (loan.status !== "sent_back") throw new ConvexError("Only applications sent back can be changed.");
    checkAmountAndTerm(args.requestedCents, args.requestedTermMonths);
    await ctx.db.patch("loans", loan._id, {
      status: "submitted",
      requestedCents: args.requestedCents,
      requestedTermMonths: args.requestedTermMonths,
      purpose: optional(args.purpose),
      ...(args.documentId ? { documentId: args.documentId, documentName: args.documentName ?? "Document" } : {}),
      submittedAt: Date.now(),
    });
  },
});

// ---------- Approvals (feature 4) ----------

export const decide = mutation({
  args: {
    loanId: v.id("loans"),
    decision: v.union(
      v.literal("approve"),
      v.literal("approve_changed"),
      v.literal("send_back"),
      v.literal("decline"),
    ),
    approvedCents: v.optional(v.number()),
    approvedTermMonths: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const manager = await requireManager(ctx);
    const loan = await ctx.db.get("loans", args.loanId);
    if (!loan) throw new ConvexError("Application not found.");
    if (loan.status !== "submitted") throw new ConvexError("This application has already been decided.");
    const note = optional(args.note);
    const decided = { decidedBy: manager._id, decidedAt: Date.now(), decisionNote: note };

    switch (args.decision) {
      case "approve":
        await ctx.db.patch("loans", loan._id, {
          ...decided,
          status: "approved",
          approvedCents: loan.requestedCents,
          approvedTermMonths: loan.requestedTermMonths,
        });
        return;
      case "approve_changed": {
        const amount = args.approvedCents ?? loan.requestedCents;
        const term = args.approvedTermMonths ?? loan.requestedTermMonths;
        checkAmountAndTerm(amount, term);
        if (amount > loan.requestedCents || term > loan.requestedTermMonths) {
          throw new ConvexError("You can lower the amount or shorten the term, but not raise them.");
        }
        if (amount === loan.requestedCents && term === loan.requestedTermMonths) {
          throw new ConvexError("Nothing changed. Use Approve as requested instead.");
        }
        await ctx.db.patch("loans", loan._id, {
          ...decided,
          status: "approved",
          approvedCents: amount,
          approvedTermMonths: term,
        });
        return;
      }
      case "send_back":
        if (!note) throw new ConvexError("Say what the officer needs to fix.");
        await ctx.db.patch("loans", loan._id, { ...decided, status: "sent_back" });
        return;
      case "decline":
        if (!note) throw new ConvexError("Give a reason for declining.");
        await ctx.db.patch("loans", loan._id, { ...decided, status: "declined" });
        return;
    }
  },
});

// ---------- Disbursement and schedule (feature 5) ----------

export const disburse = mutation({
  args: { loanId: v.id("loans"), disbursedOn: v.string(), depositReference: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const loan = await ctx.db.get("loans", args.loanId);
    if (!loan) throw new ConvexError("Loan not found.");
    if (loan.status !== "approved") throw new ConvexError("Only approved loans can be paid out.");
    if (!isValidDate(args.disbursedOn)) throw new ConvexError("Enter the deposit date.");
    if (args.disbursedOn > todayInHarare()) throw new ConvexError("The deposit date can't be in the future.");
    const depositReference = required(args.depositReference, "Bank reference");
    const amount = loan.approvedCents!;
    const term = loan.approvedTermMonths!;
    const terms = {
      monthlyRateBps: loan.monthlyRateBps,
      processingFeeBps: loan.processingFeeBps,
      insuranceBps: loan.insuranceBps,
    };
    const q = quote(amount, term, terms);
    for (const row of buildSchedule(amount, term, args.disbursedOn, terms)) {
      await ctx.db.insert("instalments", { loanId: loan._id, ...row, paidCents: 0 });
    }
    await ctx.db.patch("loans", loan._id, {
      status: "active",
      disbursedOn: args.disbursedOn,
      depositReference,
      processingFeeCents: q.processingFeeCents,
      insuranceCents: q.insuranceCents,
      payoutCents: q.payoutCents,
      interestCents: q.interestCents,
      totalRepayableCents: q.totalRepayableCents,
      disbursedBy: user._id,
    });
  },
});

// ---------- Lists and detail ----------

const APPLICATION_STATUSES = ["submitted", "sent_back", "approved", "declined"] as const;

export const listApplications = query({
  args: { status: v.optional(loanStatusValidator) },
  handler: async (ctx, { status }) => {
    await requireUser(ctx);
    const counts: Record<string, number> = {};
    for (const s of APPLICATION_STATUSES) {
      counts[s] = (await ctx.db.query("loans").withIndex("by_status", (q) => q.eq("status", s)).collect()).length;
    }
    const wanted = status ? [status] : APPLICATION_STATUSES;
    const rows: Doc<"loans">[] = [];
    for (const s of wanted) {
      rows.push(...(await ctx.db.query("loans").withIndex("by_status", (q) => q.eq("status", s)).collect()));
    }
    rows.sort((a, b) => b.submittedAt - a.submittedAt);
    const borrowers = await borrowerMap(ctx, rows.map((r) => r.borrowerId));
    const names = await userNames(ctx, rows.map((r) => r.createdBy));
    return {
      counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      rows: rows.slice(0, 300).map((l) => ({
        _id: l._id,
        reference: l.reference,
        status: l.status,
        borrowerName: borrowers.get(l.borrowerId)?.name ?? "Unknown",
        borrowerIdNumber: borrowers.get(l.borrowerId)?.idNumber ?? "",
        requestedCents: l.requestedCents,
        requestedTermMonths: l.requestedTermMonths,
        approvedCents: l.approvedCents,
        approvedTermMonths: l.approvedTermMonths,
        submittedAt: l.submittedAt,
        createdByName: names.get(l.createdBy) ?? "",
      })),
    };
  },
});

export const listLoans = query({
  args: { filter: v.union(v.literal("active"), v.literal("late"), v.literal("closed"), v.literal("all")) },
  handler: async (ctx, { filter }) => {
    await requireUser(ctx);
    const today = todayInHarare();
    const statuses = filter === "closed" ? ["closed"] : filter === "all" ? ["active", "closed"] : ["active"];
    const loans: Doc<"loans">[] = [];
    for (const s of statuses) {
      loans.push(
        ...(await ctx.db
          .query("loans")
          .withIndex("by_status", (q) => q.eq("status", s as Doc<"loans">["status"]))
          .collect()),
      );
    }
    const borrowers = await borrowerMap(ctx, loans.map((l) => l.borrowerId));
    const rows = await Promise.all(
      loans.map(async (l) => {
        const position = loanPosition(await instalmentsFor(ctx, l._id), today);
        const b = borrowers.get(l.borrowerId);
        return {
          _id: l._id,
          reference: l.reference,
          status: l.status,
          borrowerName: b?.name ?? "Unknown",
          borrowerPhone: b?.phone ?? "",
          approvedCents: l.approvedCents ?? 0,
          termMonths: l.approvedTermMonths ?? 0,
          disbursedOn: l.disbursedOn ?? "",
          closedOn: l.closedOn,
          position,
        };
      }),
    );
    const filtered = filter === "late" ? rows.filter((r) => r.position.arrearsCents > 0) : rows;
    return {
      today,
      rows: filtered.sort(
        (a, b) =>
          b.position.daysLate - a.position.daysLate ||
          (a.position.nextDueDate ?? "9999").localeCompare(b.position.nextDueDate ?? "9999"),
      ),
    };
  },
});

export const get = query({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const viewer = await requireUser(ctx);
    const loan = await ctx.db.get("loans", loanId);
    if (!loan) return null;
    const today = todayInHarare();
    const borrower = await ctx.db.get("borrowers", loan.borrowerId);
    const instalments = (await instalmentsFor(ctx, loanId)).sort((a, b) => a.number - b.number);
    const repayments = await ctx.db
      .query("repayments")
      .withIndex("by_loan", (q) => q.eq("loanId", loanId))
      .collect();
    const followUps = await ctx.db
      .query("followUps")
      .withIndex("by_loan", (q) => q.eq("loanId", loanId))
      .collect();
    const names = await userNames(ctx, [
      loan.createdBy,
      loan.decidedBy,
      loan.disbursedBy,
      ...repayments.map((r) => r.recordedBy),
      ...followUps.map((f) => f.createdBy),
    ]);
    const documentUrl = loan.documentId ? await ctx.storage.getUrl(loan.documentId) : null;
    return {
      viewerRole: viewer.role,
      today,
      loan,
      borrower,
      documentUrl,
      createdByName: names.get(loan.createdBy) ?? "",
      decidedByName: loan.decidedBy ? names.get(loan.decidedBy) ?? "" : null,
      disbursedByName: loan.disbursedBy ? names.get(loan.disbursedBy) ?? "" : null,
      instalments: instalments.map((i) => ({ ...i, status: instalmentStatus(i, today) })),
      position: instalments.length ? loanPosition(instalments, today) : null,
      repayments: repayments
        .sort((a, b) => b.receiptNumber - a.receiptNumber)
        .map((r) => ({ ...r, recordedByName: names.get(r.recordedBy) ?? "" })),
      followUps: followUps
        .sort((a, b) => b._creationTime - a._creationTime)
        .map((f) => ({ ...f, createdByName: names.get(f.createdBy) ?? "" })),
    };
  },
});
