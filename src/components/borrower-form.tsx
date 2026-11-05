"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { Button, Dialog, Field, FormError, Input, Select } from "./ui";
import { errorMessage } from "@/lib/format";

const SOURCES = ["Salary", "Business income", "Farming", "Remittances", "Pension", "Other"];

type Values = {
  name: string;
  idNumber: string;
  phone: string;
  address: string;
  employer: string;
  sourceOfFunds: string;
};

const empty: Values = { name: "", idNumber: "", phone: "", address: "", employer: "", sourceOfFunds: "Salary" };

export function BorrowerDialog({
  open,
  onClose,
  existing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  existing?: Doc<"borrowers">;
  onSaved?: (id: Id<"borrowers">) => void;
}) {
  const create = useMutation(api.borrowers.create);
  const update = useMutation(api.borrowers.update);
  const [values, setValues] = useState<Values>(existing ? pick(existing) : empty);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const otherSource = !SOURCES.slice(0, -1).includes(values.sourceOfFunds);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (existing) {
        await update({ borrowerId: existing._id, ...values });
        onSaved?.(existing._id);
      } else {
        const id = await create(values);
        setValues(empty);
        onSaved?.(id);
      }
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={existing ? "Edit borrower" : "Add borrower"}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="borrower-form" disabled={saving}>
            {saving ? "Saving…" : existing ? "Save changes" : "Add borrower"}
          </Button>
        </>
      }
    >
      <form id="borrower-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="b-name" className="sm:col-span-2">
          <Input id="b-name" value={values.name} onChange={set("name")} autoComplete="off" required />
        </Field>
        <Field label="National ID number" htmlFor="b-id" hint="As on the ID, e.g. 63-123456 A 12">
          <Input id="b-id" value={values.idNumber} onChange={set("idNumber")} autoComplete="off" required />
        </Field>
        <Field label="Phone" htmlFor="b-phone">
          <Input id="b-phone" type="tel" value={values.phone} onChange={set("phone")} placeholder="+263 77 …" required />
        </Field>
        <Field label="Address" htmlFor="b-address" className="sm:col-span-2">
          <Input id="b-address" value={values.address} onChange={set("address")} required />
        </Field>
        <Field label="Employer" htmlFor="b-employer" hint="Or the business name if self-employed">
          <Input id="b-employer" value={values.employer} onChange={set("employer")} required />
        </Field>
        <Field label="Source of funds" htmlFor="b-source">
          <Select
            id="b-source"
            value={otherSource ? "Other" : values.sourceOfFunds}
            onChange={(e) => setValues((v) => ({ ...v, sourceOfFunds: e.target.value === "Other" ? "" : e.target.value }))}
          >
            {SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        {otherSource && (
          <Field label="Describe the source of funds" htmlFor="b-source-other" className="sm:col-span-2">
            <Input id="b-source-other" value={values.sourceOfFunds} onChange={set("sourceOfFunds")} required />
          </Field>
        )}
        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
      </form>
    </Dialog>
  );
}

function pick(b: Doc<"borrowers">): Values {
  return {
    name: b.name,
    idNumber: b.idNumber,
    phone: b.phone,
    address: b.address,
    employer: b.employer,
    sourceOfFunds: b.sourceOfFunds,
  };
}
