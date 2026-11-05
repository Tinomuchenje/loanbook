"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { UserButton } from "@clerk/nextjs";
import {
  AlertTriangle,
  ClipboardCheck,
  FileText,
  Landmark,
  LayoutDashboard,
  Menu,
  Receipt,
  Upload,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { useViewer } from "./viewer";
import { Logo } from "./logo";

type NavItem = { href: string; label: string; icon: typeof Users; managerOnly?: boolean };

export function Shell({ children }: { children: ReactNode }) {
  const viewer = useViewer();
  const pathname = usePathname();
  // The phone menu closes itself on navigation: it is only "open" for the page it was opened on.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean) => setOpenOn(v ? pathname : null);

  const isManager = viewer.role === "manager";
  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/borrowers", label: "Borrowers", icon: Users },
    { href: "/applications", label: isManager ? "Approvals" : "Applications", icon: isManager ? ClipboardCheck : FileText },
    { href: "/loans", label: "Loans", icon: Landmark },
    { href: "/repayments", label: "Repayments", icon: Receipt },
    { href: "/arrears", label: "Arrears", icon: AlertTriangle },
    { href: "/staff", label: "Staff", icon: UserCog, managerOnly: true },
    { href: "/import", label: "Import", icon: Upload, managerOnly: true },
  ];

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {items
        .filter((i) => !i.managerOnly || isManager)
        .map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-brand-soft text-brand" : "text-muted hover:bg-sunk hover:text-ink",
              )}
            >
              <Icon size={18} strokeWidth={active ? 2.25 : 1.75} />
              {item.label}
            </Link>
          );
        })}
    </nav>
  );

  const userCard = (
    <div className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
      <UserButton />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{viewer.name}</div>
        <div className="text-[12px] capitalize text-muted">{viewer.role === "manager" ? "Manager" : "Loan officer"}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-line bg-surface px-4 py-5 lg:flex">
        <Logo />
        {nav}
        <div className="mt-auto">{userCard}</div>
      </aside>

      {/* Phone and tablet bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-lg border border-line"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 bg-navy/40 lg:hidden" onClick={() => setOpen(false)}>
          <div
            className="flex h-full w-72 max-w-[85%] flex-col gap-6 bg-surface px-4 py-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <Logo />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg text-muted"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>
            {nav}
            <div className="mt-auto">{userCard}</div>
          </div>
        </div>
      )}

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
