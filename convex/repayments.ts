import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";
import { isValidDate, todayInHarare } from "./lib/loanMath";
import { applyPayment } from "./lib/repaymentRules";
import { borrowerMap } from "./lib/loanData";

// ---------- Repayments (feature 6) ----------

export const record = mutation({
  args: {
    loanId: v.id("loans"),
    amountCents: v.number(),
    paidOn: v.string(),
    method: v.union(v.literal("cash"), v.literal("direct_debit")),
    reference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const loan = await ctx.db.get("loans", args.loanId);
    if (!loan) throw new ConvexError("Loan not found.");
    if (loan.status !== "active") throw new ConvexError("Payments can only be recorded on active loans.");
    if (!Number.isInteger(args.amountCents) || args.amountCents <= 0) {
      throw new ConvexError("Enter an amount greater than zero.");
    }
    if (!isValidDate(args.paidOn)) throw new ConvexError("Enter the date the payment was received.");
    if (args.paidOn > todayInHarare()) throw new ConvexError("The payment date can't be in the future.");
    if (loan.disbursedOn && args.paidOn < loan.disbursedOn) {
      throw new ConvexError("The payment date can't be before the loan was paid out.");
    }
    return await applyPayment(ctx, loan, { ...args, recordedBy: user._id });
  },
});

export const listRecent = query({
  args: { onlyToday: v.optional(v.boolean()), limit: v.optional(v.number()) },
  handler: async (ctx, { onlyToday, limit }) => {
    await requireUser(ctx);
    const today = todayInHarare();
    const take = Math.min(Math.max(limit ?? 25, 1), 200);
    const rows = onlyToday
      ? await ctx.db
          .query("repayments")
          .withIndex("by_paidOn", (q) => q.eq("paidOn", today))
          .order("desc")
          .take(take)
      : await ctx.db.query("repayments").withIndex("by_paidOn").order("desc").take(take);
    const loans = new Map(
      (await Promise.all([...new Set(rows.map((r) => r.loanId))].map((id) => ctx.db.get("loans", id))))
        .filter((l) => l !== null)
        .map((l) => [l._id, l]),
    );
    const borrowers = await borrowerMap(
      ctx,
      [...loans.values()].map((l) => l.borrowerId),
    );
    return {
      today,
      rows: rows.map((r) => {
        const loan = loans.get(r.loanId);
        const b = loan ? borrowers.get(loan.borrowerId) : undefined;
        return {
          ...r,
          loanReference: loan?.reference ?? "",
          loanStatus: loan?.status ?? "active",
          borrowerName: b?.name ?? "Unknown",
          borrowerIdNumber: b?.idNumber ?? "",
          termMonths: loan?.approvedTermMonths ?? 0,
        };
      }),
    };
  },
});
