"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { useQuery } from "convex/react";
import { Plus, Search } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Button, Card, EmptyState, Input, Loading, PageHeader, Pill, Table, Td, Th } from "@/components/ui";
import { BorrowerCell } from "@/components/loan-bits";
import { BorrowerDialog } from "@/components/borrower-form";

export default function BorrowersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search);
  const rows = useQuery(api.borrowers.list, { search: deferred || undefined });
  const [adding, setAdding] = useState(false);

  return (
    <>
      <PageHeader
        title="Borrowers"
        description="Everyone who has applied for a loan. Search by name or national ID number."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} /> Add borrower
          </Button>
        }
      />
      <Card>
        <div className="border-b border-line p-4">
          <label className="relative block max-w-md">
            <span className="sr-only">Search borrowers</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <Input
              type="search"
              placeholder="Name or ID number"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </label>
        </div>
        {rows === undefined ? (
          <Loading />
        ) : rows.length === 0 ? (
          search ? (
            <EmptyState title={`No borrower matches “${search}”`}>Check the spelling, or add them as a new borrower.</EmptyState>
          ) : (
            <EmptyState
              title="No borrowers yet"
              action={
                <Button onClick={() => setAdding(true)}>
                  <Plus size={16} /> Add the first borrower
                </Button>
              }
            >
              Add a borrower before capturing their loan application.
            </EmptyState>
          )
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Borrower</Th>
                <Th>Phone</Th>
                <Th>Employer</Th>
                <Th>Source of funds</Th>
                <Th>Loans</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr
                  key={b._id}
                  className="cursor-pointer hover:bg-sunk/60"
                  onClick={() => router.push(`/borrowers/${b._id}`)}
                >
                  <Td>
                    <BorrowerCell name={b.name} sub={`ID ${b.idNumber}`} href={`/borrowers/${b._id}`} />
                  </Td>
                  <Td className="whitespace-nowrap">{b.phone}</Td>
                  <Td>{b.employer}</Td>
                  <Td>{b.sourceOfFunds}</Td>
                  <Td>
                    {b.activeLoans > 0 ? (
                      <Pill tone="brand">{b.activeLoans} active</Pill>
                    ) : (
                      <span className="text-muted">{b.loanCount === 0 ? "None yet" : `${b.loanCount} past`}</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {adding && (
        <BorrowerDialog open onClose={() => setAdding(false)} onSaved={(id) => router.push(`/borrowers/${id}`)} />
      )}
    </>
  );
}
