import Link from "next/link";

export function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5" aria-label="Loan Book home">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-navy text-white">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
          <path d="M5 4.5h9.5a3 3 0 0 1 3 3V19.5H8a3 3 0 0 1-3-3v-12Z" stroke="currentColor" strokeWidth="1.7" />
          <path d="M8.5 9h5.5M8.5 12.5h5.5" stroke="#34c46a" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold">Loan Book</span>
        <span className="block text-[11.5px] text-muted">Lending, kept straight</span>
      </span>
    </Link>
  );
}
