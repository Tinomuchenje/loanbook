import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";
import { loanPosition, normaliseIdNumber, todayInHarare } from "./lib/loanMath";
import { assertIdNumberFree, cleanBorrower } from "./lib/borrowerRules";

const borrowerFields = {
  name: v.string(),
  idNumber: v.string(),
  address: v.string(),
  phone: v.string(),
  employer: v.string(),
  sourceOfFunds: v.string(),
};

export const list = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, { search }) => {
    await requireUser(ctx);
    const term = search?.trim() ?? "";
    let rows;
    if (term) {
      const byName = await ctx.db
        .query("borrowers")
        .withSearchIndex("search_name", (q) => q.search("name", term))
        .take(50);
      const byId = await ctx.db
        .query("borrowers")
        .withIndex("by_idNumber", (q) => q.eq("idNumber", normaliseIdNumber(term)))
        .take(5);
      const seen = new Set<string>();
      rows = [...byId, ...byName].filter((b) => (seen.has(b._id) ? false : (seen.add(b._id), true)));
    } else {
      rows = await ctx.db.query("borrowers").order("desc").take(200);
    }
    return await Promise.all(
      rows.map(async (b) => {
        const loans = await ctx.db
          .query("loans")
          .withIndex("by_borrower", (q) => q.eq("borrowerId", b._id))
          .collect();
        return {
          ...b,
          loanCount: loans.length,
          activeLoans: loans.filter((l) => l.status === "active").length,
        };
      }),
    );
  },
});

export const get = query({
  args: { borrowerId: v.id("borrowers") },
  handler: async (ctx, { borrowerId }) => {
    await requireUser(ctx);
    const borrower = await ctx.db.get("borrowers", borrowerId);
    if (!borrower) return null;
    const today = todayInHarare();
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", borrowerId))
      .order("desc")
      .collect();
    const withPosition = await Promise.all(
      loans.map(async (loan) => {
        const instalments = await ctx.db
          .query("instalments")
          .withIndex("by_loan", (q) => q.eq("loanId", loan._id))
          .collect();
        return { ...loan, position: instalments.length ? loanPosition(instalments, today) : null };
      }),
    );
    return { borrower, loans: withPosition, today };
  },
});

export const create = mutation({
  args: borrowerFields,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const clean = cleanBorrower(args);
    await assertIdNumberFree(ctx, clean.idNumber);
    return await ctx.db.insert("borrowers", { ...clean, createdBy: user._id });
  },
});

export const update = mutation({
  args: { borrowerId: v.id("borrowers"), ...borrowerFields },
  handler: async (ctx, { borrowerId, ...args }) => {
    await requireUser(ctx);
    const existing = await ctx.db.get("borrowers", borrowerId);
    if (!existing) throw new ConvexError("Borrower not found.");
    const clean = cleanBorrower(args);
    await assertIdNumberFree(ctx, clean.idNumber, borrowerId);
    await ctx.db.patch("borrowers", borrowerId, clean);
  },
});
