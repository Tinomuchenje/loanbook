import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

/** The signed-in staff member, or null if signed out or switched off. */
export async function getViewer(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const user = await ctx.db.get("users", userId);
  if (!user || !user.active) return null;
  return user;
}

export async function requireUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await getViewer(ctx);
  if (!user) throw new ConvexError("Sign in to continue.");
  return user;
}

export async function requireManager(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "manager") throw new ConvexError("Only a manager can do this.");
  return user;
}
