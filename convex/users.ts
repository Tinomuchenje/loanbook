import { ConvexError, v } from "convex/values";
import { getAuthUserId, invalidateSessions, modifyAccountCredentials } from "@convex-dev/auth/server";
import { action, internalQuery, mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { requireManager } from "./lib/auth";
import { roleValidator } from "./schema";
import { required } from "./lib/util";

async function hasPasswordAccount(ctx: QueryCtx, userId: Id<"users">) {
  const account = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId).eq("provider", "password"))
    .first();
  return account !== null;
}

/**
 * Where the signed-in person stands:
 * - "signed_out": no session
 * - "inactive": signed in, but the manager switched the account off (or it no longer exists)
 * - "ok": an active staff member
 */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { state: "signed_out" as const, user: null };
    const user = await ctx.db.get("users", userId);
    if (!user || !user.active) return { state: "inactive" as const, user: null };
    return { state: "ok" as const, user };
  },
});

export const listStaff = query({
  args: {},
  handler: async (ctx) => {
    await requireManager(ctx);
    const users = await ctx.db.query("users").collect();
    const rows = await Promise.all(
      users.map(async (u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        active: u.active,
        hasAccount: await hasPasswordAccount(ctx, u._id),
      })),
    );
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const addStaff = mutation({
  args: { name: v.string(), email: v.string(), role: roleValidator },
  handler: async (ctx, args) => {
    await requireManager(ctx);
    const name = required(args.name, "Name");
    const email = required(args.email, "Email").toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ConvexError("Enter a valid email address.");
    const clash = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (clash) throw new ConvexError(`${email} is already on the staff list.`);
    return await ctx.db.insert("users", { name, email, role: args.role, active: true });
  },
});

export const updateStaff = mutation({
  args: { userId: v.id("users"), role: v.optional(roleValidator), active: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const me = await requireManager(ctx);
    if (args.userId === me._id && (args.role === "officer" || args.active === false)) {
      throw new ConvexError("You can't remove your own manager access. Ask another manager.");
    }
    const target = await ctx.db.get("users", args.userId);
    if (!target) throw new ConvexError("Staff member not found.");
    const patch: { role?: "officer" | "manager"; active?: boolean } = {};
    if (args.role) patch.role = args.role;
    if (args.active !== undefined) patch.active = args.active;
    await ctx.db.patch("users", args.userId, patch);
  },
});

/** Used by setPassword: checks the caller is a manager and returns the target's sign-in email. */
export const passwordTarget = internalQuery({
  args: { managerId: v.id("users"), userId: v.id("users") },
  handler: async (ctx, { managerId, userId }) => {
    const manager = await ctx.db.get("users", managerId);
    if (!manager || !manager.active || manager.role !== "manager") return { error: "Only a manager can do this." };
    const target = await ctx.db.get("users", userId);
    if (!target) return { error: "Staff member not found." };
    if (!(await hasPasswordAccount(ctx, userId))) {
      return { error: `${target.name} hasn't created an account yet. They can create one on the sign-in page.` };
    }
    return { email: target.email };
  },
});

/** A manager sets a new password for someone who has forgotten theirs. Signs them out everywhere. */
export const setPassword = action({
  args: { userId: v.id("users"), password: v.string() },
  handler: async (ctx, { userId, password }) => {
    const managerId = await getAuthUserId(ctx);
    if (!managerId) throw new ConvexError("Sign in to continue.");
    if (password.length < 8) throw new ConvexError("Use at least 8 characters for the password.");
    const target = await ctx.runQuery(internal.users.passwordTarget, { managerId, userId });
    if (!target.email) throw new ConvexError(target.error ?? "Staff member not found.");
    await modifyAccountCredentials(ctx, { provider: "password", account: { id: target.email, secret: password } });
    if (userId !== managerId) await invalidateSessions(ctx, { userId });
  },
});
