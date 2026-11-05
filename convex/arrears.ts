import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";
import { isValidDate, loanPosition, todayInHarare } from "./lib/loanMath";
import { borrowerMap, instalmentsFor } from "./lib/loanData";
import { required } from "./lib/util";

// ---------- Arrears and follow-up (feature 7) ----------

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const today = todayInHarare();
    const active = await ctx.db
      .query("loans")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const borrowers = await borrowerMap(ctx, active.map((l) => l.borrowerId));
    const rows = [];
    for (const loan of active) {
      const position = loanPosition(await instalmentsFor(ctx, loan._id), today);
      if (position.arrearsCents <= 0) continue;
      const lastFollowUp = await ctx.db
        .query("followUps")
        .withIndex("by_loan", (q) => q.eq("loanId", loan._id))
        .order("desc")
        .first();
      const b = borrowers.get(loan.borrowerId);
      rows.push({
        loanId: loan._id,
        reference: loan.reference,
        borrowerName: b?.name ?? "Unknown",
        borrowerPhone: b?.phone ?? "",
        arrearsCents: position.arrearsCents,
        outstandingCents: position.outstandingCents,
        daysLate: position.daysLate,
        oldestLateDue: position.oldestLateDue,
        lastFollowUp: lastFollowUp
          ? { note: lastFollowUp.note, promisedDate: lastFollowUp.promisedDate, at: lastFollowUp._creationTime }
          : null,
      });
    }
    rows.sort((a, b) => b.daysLate - a.daysLate || b.arrearsCents - a.arrearsCents);
    return {
      today,
      rows,
      totalArrearsCents: rows.reduce((s, r) => s + r.arrearsCents, 0),
    };
  },
});

export const addFollowUp = mutation({
  args: { loanId: v.id("loans"), note: v.string(), promisedDate: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const loan = await ctx.db.get("loans", args.loanId);
    if (!loan) throw new ConvexError("Loan not found.");
    const promisedDate = args.promisedDate?.trim() || undefined;
    if (promisedDate && !isValidDate(promisedDate)) throw new ConvexError("Enter a valid promised date.");
    return await ctx.db.insert("followUps", {
      loanId: loan._id,
      note: required(args.note, "Note"),
      promisedDate,
      createdBy: user._id,
    });
  },
});
