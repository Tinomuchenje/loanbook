"use client";

import { PageHeader } from "@/components/ui";
import { RepaymentsCard } from "@/components/repayments-table";

export default function RepaymentsPage() {
  return (
    <>
      <PageHeader
        title="Repayments"
        description="Every payment received, newest first. To record a payment, open the borrower's loan."
      />
      <RepaymentsCard title="All repayments" pageSize={25} />
    </>
  );
}
