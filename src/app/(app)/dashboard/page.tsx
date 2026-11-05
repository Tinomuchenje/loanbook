"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowRight, AlertTriangle, Landmark, Wallet, ClipboardCheck, Banknote } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Card, CardHeader, EmptyState, Loading, Progress, Table, Td, Th } from "@/components/ui";
import { BorrowerCell } from "@/components/loan-bits";
import { RepaymentsCard } from "@/components/repayments-table";
import { formatDate, formatMoney, monthName, percent, plural, weekday } from "@/lib/format";

function previousMonthDate(today: string) {
  const [y, m] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
}

function greeting() {
  const h = new Date(Date.now() + 2 * 3600 * 1000).getUTCHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const d = useQuery(api.dashboard.summary, {});
  if (d === undefined) return <Loading label="Adding up the loan book…" />;

  const isManager = d.viewer.role === "manager";
  const firstName = d.viewer.name.split(" ")[0];
  const collectedShare = d.dueTodayCents > 0 ? d.collectedToday / d.dueTodayCents : 0;
  const waiting = isManager ? d.pendingApprovals : d.awaitingPayout + d.sentBack;

  return (
    <>
      {/* Navy summary band */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr]">
        <div className="flex flex-col gap-5 rounded-card bg-navy p-5 text-white sm:flex-row sm:items-stretch">
          <div className="flex flex-col">
            <p className="text-[13px] text-navy-muted">
              {greeting()}, {firstName}
            </p>
            <h1 className="mt-1 text-lg font-semibold">Loan book overview</h1>
            <div className="mt-auto pt-4">
              <div className="text-sm text-navy-muted">{weekday(d.today)}</div>
              <div className="tnum text-5xl font-semibold leading-none tracking-tight">{Number(d.today.slice(8))}</div>
              <div className="mt-1 text-sm text-navy-muted">
                {monthName(d.today)} {d.today.slice(0, 4)}
              </div>
            </div>
          </div>
          <div className="flex flex-1 flex-col justify-between gap-3 rounded-xl border border-navy-line bg-navy-2 p-4">
            <p className="text-sm leading-relaxed">
              {plural(d.dueToday.length, "repayment")} due today
              {isManager
                ? ` and ${plural(d.pendingApprovals, "application")} waiting for your decision.`
                : ` and ${plural(d.awaitingPayout, "approved loan")} to pay out.`}
            </p>
            <Link
              href={isManager ? "/applications?status=submitted" : "/applications?status=approved"}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-bright hover:underline"
            >
              {isManager ? "Open approvals" : "Open applications"} <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        <Link href="/repayments" className="group flex flex-col rounded-card bg-navy p-5 text-white">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/25 text-brand-bright">
              <Banknote size={17} />
            </span>
            <div>
              <div className="text-[15px] font-semibold">Today&apos;s collections</div>
              <div className="text-[12px] text-navy-muted">{formatDate(d.today)}</div>
            </div>
          </div>
          <div className="tnum mt-4 text-3xl font-semibold tracking-tight">{formatMoney(d.collectedToday)}</div>
          <div className="mt-1 text-[13px] text-navy-muted">
            Collected from {plural(d.paymentsToday, "payment")}
          </div>
          <div className="mt-auto flex items-center gap-3 pt-4">
            <Progress value={collectedShare} tone="bright" />
            <span className="tnum text-[13px]">{d.dueTodayCents > 0 ? percent(Math.min(collectedShare, 1)) : "—"}</span>
          </div>
          <div className="mt-2 text-[12.5px] text-navy-muted">
            {d.dueTodayCents === 0
              ? "Nothing scheduled for today"
              : collectedShare >= 1
                ? `Today's ${formatMoney(d.dueTodayCents)} is covered`
                : `${formatMoney(d.dueTodayCents - d.collectedToday)} of ${formatMoney(d.dueTodayCents)} due today still to collect`}
          </div>
        </Link>

        <Link
          href={isManager ? "/applications?status=submitted" : "/applications?status=approved"}
          className="flex flex-col rounded-card bg-navy p-5 text-white md:col-span-2 xl:col-span-1"
        >
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">
              <ClipboardCheck size={17} />
            </span>
            <div className="text-[15px] font-semibold">{isManager ? "Waiting for approval" : "Your next steps"}</div>
          </div>
          <div className="tnum mt-4 text-3xl font-semibold">{waiting}</div>
          <div className="mt-1 text-[13px] text-navy-muted">
            {isManager
              ? plural(d.pendingApprovals, "application") + " to decide"
              : `${plural(d.awaitingPayout, "loan")} to pay out · ${d.sentBack} sent back`}
          </div>
          <div className="mt-auto grid grid-cols-2 gap-2 pt-4 text-[12.5px]">
            <span className="rounded-lg bg-navy-2 px-3 py-2">
              <span className="tnum block text-base font-semibold">{d.awaitingPayout}</span>
              <span className="text-navy-muted">to pay out</span>
            </span>
            <span className="rounded-lg bg-navy-2 px-3 py-2">
              <span className="tnum block text-base font-semibold">{d.sentBack}</span>
              <span className="text-navy-muted">sent back</span>
            </span>
          </div>
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          href="/loans"
          icon={<Landmark size={20} />}
          iconClass="bg-info-soft text-info"
          title="Outstanding"
          sub="Still owed on active loans"
          value={formatMoney(d.outstandingCents)}
          foot={`${plural(d.activeLoans, "active loan")} · ${plural(d.borrowerCount, "borrower")}`}
        />
        <StatCard
          href="/arrears"
          icon={<AlertTriangle size={20} />}
          iconClass="bg-bad-soft text-bad"
          title="In arrears"
          sub="Instalments past their due date"
          value={formatMoney(d.arrearsCents)}
          valueClass={d.arrearsCents > 0 ? "text-ink" : undefined}
          foot={
            d.loansInArrears > 0 ? (
              <span className="text-bad">
                {percent(d.arrearsShare)} of the outstanding balance · {plural(d.loansInArrears, "loan")}
              </span>
            ) : (
              "Nobody is behind"
            )
          }
        />
        <StatCard
          href="/repayments"
          icon={<Wallet size={20} />}
          iconClass="bg-brand-soft text-brand"
          title={`Collected in ${monthName(d.today)}`}
          sub="Payments received this month"
          value={formatMoney(d.collectedThisMonth)}
          foot={
            d.collectedLastMonth > 0
              ? `${monthName(previousMonthDate(d.today))}: ${formatMoney(d.collectedLastMonth)}`
              : "Nothing collected last month"
          }
        />
      </div>

      {/* Due today */}
      <Card>
        <CardHeader title="Due today" sub="Instalments that fall due today and aren't paid yet" />
        {d.dueToday.length === 0 ? (
          <EmptyState title="Nothing due today" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Borrower</Th>
                <Th>Loan</Th>
                <Th align="right">Due today</Th>
              </tr>
            </thead>
            <tbody>
              {d.dueToday.map((r) => (
                <tr key={r.loanId} className="hover:bg-sunk/60">
                  <Td>
                    <BorrowerCell name={r.borrowerName} sub={r.borrowerPhone} />
                  </Td>
                  <Td>
                    <Link href={`/loans/${r.loanId}`} className="whitespace-nowrap font-medium text-brand hover:underline">
                      {r.reference}
                    </Link>
                  </Td>
                  <Td align="right" className="font-medium">
                    {formatMoney(r.amountCents)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <RepaymentsCard pageSize={5} viewAllHref="/repayments" />
    </>
  );
}

function StatCard({
  href,
  icon,
  iconClass,
  title,
  sub,
  value,
  valueClass,
  foot,
}: {
  href: string;
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  sub: string;
  value: string;
  valueClass?: string;
  foot: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 transition-colors hover:border-faint"
    >
      <div className="flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${iconClass}`}>{icon}</span>
        <div className="min-w-0">
          <div className="font-semibold">{title}</div>
          <div className="text-[13px] text-muted">{sub}</div>
        </div>
        <ArrowRight size={16} className="ml-auto mt-1 shrink-0 text-faint" />
      </div>
      <div className={`tnum text-3xl font-semibold tracking-tight ${valueClass ?? ""}`}>{value}</div>
      <div className="text-[13px] text-muted">{foot}</div>
    </Link>
  );
}
