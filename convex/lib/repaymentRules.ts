import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { allocatePayment, formatMoney } from "./loanMath";
import { instalmentsFor } from "./loanData";
import { nextNumber, optional } from "./util";

/**
 * Applies a payment to a loan: fills the oldest instalments first, issues a receipt number,
 * and closes the loan when the balance reaches zero. Shared by recording and importing.
 */
export async function applyPayment(
  ctx: MutationCtx,
  loan: Doc<"loans">,
  payment: {
    amountCents: number;
    paidOn: string;
    method: "cash" | "direct_debit" | "import";
    reference?: string;
    recordedBy: Id<"users">;
  },
) {
  const instalments = await instalmentsFor(ctx, loan._id);
  const outstanding = instalments.reduce((s, i) => s + i.amountCents - i.paidCents, 0);
  if (payment.amountCents > outstanding) {
    throw new ConvexError(`That's more than the ${formatMoney(outstanding)} still owed.`);
  }
  const { updates } = allocatePayment(instalments, payment.amountCents);
  for (const u of updates) {
    await ctx.db.patch("instalments", u.instalment._id, { paidCents: u.paidCents });
  }
  const receiptNumber = await nextNumber(ctx, "receipt");
  const repaymentId = await ctx.db.insert("repayments", {
    loanId: loan._id,
    paidOn: payment.paidOn,
    amountCents: payment.amountCents,
    method: payment.method,
    reference: optional(payment.reference),
    receiptNumber,
    recordedBy: payment.recordedBy,
  });
  const closes = payment.amountCents === outstanding;
  await ctx.db.patch("loans", loan._id, {
    paidCents: loan.paidCents + payment.amountCents,
    ...(closes ? { status: "closed" as const, closedOn: payment.paidOn } : {}),
  });
  return { repaymentId, receiptNumber, closed: closes, remainingCents: outstanding - payment.amountCents };
}
