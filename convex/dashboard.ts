import { query } from "./_generated/server";
import { requireUser } from "./lib/auth";
import { loanPosition, todayInHarare } from "./lib/loanMath";
import { borrowerMap, instalmentsFor } from "./lib/loanData";

// ---------- Dashboard (feature 8) ----------

function monthKey(date: string) {
  return date.slice(0, 7);
}

function previousMonth(key: string) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

export const summary = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireUser(ctx);
    const today = todayInHarare();
    const thisMonth = monthKey(today);
    const lastMonth = previousMonth(thisMonth);

    const active = await ctx.db
      .query("loans")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const borrowers = await borrowerMap(ctx, active.map((l) => l.borrowerId));

    let outstandingCents = 0;
    let arrearsCents = 0;
    let atRiskOutstandingCents = 0;
    let loansInArrears = 0;
    let dueTodayCents = 0;
    const dueToday: {
      loanId: string;
      reference: string;
      borrowerName: string;
      borrowerPhone: string;
      amountCents: number;
    }[] = [];

    for (const loan of active) {
      const instalments = await instalmentsFor(ctx, loan._id);
      const p = loanPosition(instalments, today);
      outstandingCents += p.outstandingCents;
      arrearsCents += p.arrearsCents;
      if (p.arrearsCents > 0) {
        loansInArrears++;
        atRiskOutstandingCents += p.outstandingCents;
      }
      // Everything scheduled for today, whether or not it's been paid, so collected-vs-due adds up.
      const scheduledToday = instalments
        .filter((i) => i.dueDate === today)
        .reduce((s, i) => s + i.amountCents, 0);
      dueTodayCents += scheduledToday;
      if (p.dueTodayCents > 0) {
        const b = borrowers.get(loan.borrowerId);
        dueToday.push({
          loanId: loan._id,
          reference: loan.reference,
          borrowerName: b?.name ?? "Unknown",
          borrowerPhone: b?.phone ?? "",
          amountCents: p.dueTodayCents,
        });
      }
    }

    // Collections: this month and last month, by payment date. Imported opening balances don't count.
    const sinceLastMonth = `${lastMonth}-01`;
    const recentPayments = await ctx.db
      .query("repayments")
      .withIndex("by_paidOn", (q) => q.gte("paidOn", sinceLastMonth))
      .collect();
    let collectedToday = 0;
    let collectedThisMonth = 0;
    let collectedLastMonth = 0;
    let paymentsToday = 0;
    for (const r of recentPayments) {
      if (r.method === "import") continue;
      if (r.paidOn === today) {
        collectedToday += r.amountCents;
        paymentsToday++;
      }
      if (monthKey(r.paidOn) === thisMonth) collectedThisMonth += r.amountCents;
      else if (monthKey(r.paidOn) === lastMonth) collectedLastMonth += r.amountCents;
    }

    const pendingApprovals = (
      await ctx.db
        .query("loans")
        .withIndex("by_status", (q) => q.eq("status", "submitted"))
        .collect()
    ).length;
    const awaitingPayout = (
      await ctx.db
        .query("loans")
        .withIndex("by_status", (q) => q.eq("status", "approved"))
        .collect()
    ).length;
    const sentBack = (
      await ctx.db
        .query("loans")
        .withIndex("by_status", (q) => q.eq("status", "sent_back"))
        .collect()
    ).length;
    const borrowerCount = (await ctx.db.query("borrowers").collect()).length;

    return {
      viewer: { name: viewer.name, role: viewer.role },
      today,
      activeLoans: active.length,
      borrowerCount,
      outstandingCents,
      arrearsCents,
      loansInArrears,
      arrearsShare: outstandingCents > 0 ? arrearsCents / outstandingCents : 0,
      atRiskShare: outstandingCents > 0 ? atRiskOutstandingCents / outstandingCents : 0,
      dueTodayCents,
      collectedToday,
      paymentsToday,
      collectedThisMonth,
      collectedLastMonth,
      pendingApprovals,
      awaitingPayout,
      sentBack,
      dueToday: dueToday.sort((a, b) => b.amountCents - a.amountCents),
    };
  },
});
