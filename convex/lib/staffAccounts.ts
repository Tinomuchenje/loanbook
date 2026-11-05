import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Called when someone creates a password account.
 * - Nobody on the staff list yet: this person becomes the manager.
 * - Their email is on the staff list: the account is linked to that staff record.
 * - Otherwise: refused.
 */
export async function linkStaffAccount(
  ctx: MutationCtx,
  profile: { email: string; name: string },
): Promise<Id<"users">> {
  const email = profile.email.trim().toLowerCase();
  const anyone = await ctx.db.query("users").first();
  if (!anyone) {
    return await ctx.db.insert("users", {
      email,
      name: profile.name.trim() || email,
      role: "manager",
      active: true,
    });
  }
  const staff = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .unique();
  if (!staff) {
    throw new ConvexError(`${email} isn't on the staff list. Ask your manager to add it under Staff, then try again.`);
  }
  if (!staff.active) throw new ConvexError("This account is switched off. Ask your manager to switch it back on.");
  if (!staff.name && profile.name.trim()) await ctx.db.patch("users", staff._id, { name: profile.name.trim() });
  return staff._id;
}
