import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";

/** Trims a text field and rejects it if empty. */
export function required(value: string, label: string): string {
  const v = value.trim();
  if (!v) throw new ConvexError(`${label} is required.`);
  if (v.length > 500) throw new ConvexError(`${label} is too long.`);
  return v;
}

export function optional(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v.slice(0, 1000) : undefined;
}

/** Increments a named counter and returns the new value (receipt and loan numbers). */
export async function nextNumber(ctx: MutationCtx, name: string): Promise<number> {
  const row = await ctx.db
    .query("counters")
    .withIndex("by_name", (q) => q.eq("name", name))
    .unique();
  if (!row) {
    await ctx.db.insert("counters", { name, value: 1 });
    return 1;
  }
  await ctx.db.patch("counters", row._id, { value: row.value + 1 });
  return row.value + 1;
}

export function loanReference(n: number): string {
  return `LN-${String(n).padStart(5, "0")}`;
}
