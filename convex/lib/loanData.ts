import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { loanPosition } from "./loanMath";

export async function instalmentsFor(ctx: QueryCtx, loanId: Id<"loans">) {
  return await ctx.db
    .query("instalments")
    .withIndex("by_loan", (q) => q.eq("loanId", loanId))
    .collect();
}

export async function withPosition(ctx: QueryCtx, loan: Doc<"loans">, today: string) {
  const instalments = await instalmentsFor(ctx, loan._id);
  return { loan, instalments, position: loanPosition(instalments, today) };
}

/** Borrower names and phones for a set of loans, fetched once each. */
export async function borrowerMap(ctx: QueryCtx, ids: Id<"borrowers">[]) {
  const unique = [...new Set(ids)];
  const docs = await Promise.all(unique.map((id) => ctx.db.get("borrowers", id)));
  const map = new Map<Id<"borrowers">, Doc<"borrowers">>();
  docs.forEach((d) => d && map.set(d._id, d));
  return map;
}

export async function userNames(ctx: QueryCtx, ids: (Id<"users"> | undefined)[]) {
  const unique = [...new Set(ids.filter(Boolean) as Id<"users">[])];
  const docs = await Promise.all(unique.map((id) => ctx.db.get("users", id)));
  const map = new Map<Id<"users">, string>();
  docs.forEach((d) => d && map.set(d._id, d.name));
  return map;
}
