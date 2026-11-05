"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button, Card, CardHeader, EmptyState, Field, FormError, Input, Loading, PageHeader, Pill, Select, Table, Td, Th } from "@/components/ui";
import { BorrowerCell } from "@/components/loan-bits";
import { useIsManager, useViewer } from "@/components/viewer";
import { errorMessage } from "@/lib/format";

export default function StaffPage() {
  const isManager = useIsManager();
  if (!isManager) return <EmptyState title="Only managers can manage staff" />;
  return <Staff />;
}

function Staff() {
  const me = useViewer();
  const staff = useQuery(api.users.listStaff, {});
  const add = useMutation(api.users.addStaff);
  const update = useMutation(api.users.updateStaff);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"officer" | "manager">("officer");
  const [error, setError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await add({ name, email, role });
      setName("");
      setEmail("");
      setRole("officer");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function change(userId: Id<"users">, patch: { role?: "officer" | "manager"; active?: boolean }) {
    setRowError(null);
    try {
      await update({ userId, ...patch });
    } catch (err) {
      setRowError(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        title="Staff"
        description="Add loan officers and managers by email. They sign in with that address and get access straight away."
      />
      <Card>
        <CardHeader title="Add a staff member" />
        <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-[1fr_1fr_180px_auto] sm:items-end">
          <Field label="Name" htmlFor="s-name">
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Email" htmlFor="s-email">
            <Input id="s-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Role" htmlFor="s-role">
            <Select id="s-role" value={role} onChange={(e) => setRole(e.target.value as "officer" | "manager")}>
              <option value="officer">Loan officer</option>
              <option value="manager">Manager</option>
            </Select>
          </Field>
          <Button type="submit" disabled={saving}>
            {saving ? "Adding…" : "Add"}
          </Button>
          <div className="sm:col-span-4">
            <FormError message={error} />
          </div>
        </form>
      </Card>
      <Card>
        <CardHeader title="Everyone with access" sub="Only managers can approve loans, manage staff and import." />
        {rowError && (
          <div className="px-5 pt-4">
            <FormError message={rowError} />
          </div>
        )}
        {staff === undefined ? (
          <Loading />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s._id}>
                  <Td>
                    <BorrowerCell name={s.name} sub={s.email} />
                  </Td>
                  <Td>
                    <Select
                      aria-label={`Role for ${s.name}`}
                      value={s.role}
                      disabled={s._id === me._id}
                      onChange={(e) => change(s._id, { role: e.target.value as "officer" | "manager" })}
                      className="h-9 w-40"
                    >
                      <option value="officer">Loan officer</option>
                      <option value="manager">Manager</option>
                    </Select>
                  </Td>
                  <Td>
                    {!s.active ? (
                      <Pill tone="neutral">Switched off</Pill>
                    ) : s.hasSignedIn ? (
                      <Pill tone="ok">Active</Pill>
                    ) : (
                      <Pill tone="warn">Hasn&apos;t signed in yet</Pill>
                    )}
                  </Td>
                  <Td align="right">
                    {s._id !== me._id && (
                      <Button variant={s.active ? "danger" : "secondary"} size="sm" onClick={() => change(s._id, { active: !s.active })}>
                        {s.active ? "Switch off" : "Switch on"}
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
