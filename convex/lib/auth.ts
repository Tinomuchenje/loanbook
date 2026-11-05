import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

/** The signed-in staff member, or null if not signed in, not added, or switched off. */
export async function getViewer(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (!user || !user.active) return null;
  return user;
}

export async function requireUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await getViewer(ctx);
  if (!user) throw new ConvexError("Sign in with an account your manager has added.");
  return user;
}

export async function requireManager(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "manager") throw new ConvexError("Only a manager can do this.");
  return user;
}
