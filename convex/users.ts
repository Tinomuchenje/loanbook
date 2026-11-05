import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireManager } from "./lib/auth";
import { roleValidator } from "./schema";
import { required } from "./lib/util";

/**
 * Where the signed-in person stands:
 * - "signed_out": no Clerk session
 * - "needs_link": signed in, but this Clerk account isn't linked to a staff record yet (call `link`)
 * - "ok": a linked, active staff member
 * - "inactive": linked but switched off by the manager
 */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { state: "signed_out" as const, user: null };
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return { state: "needs_link" as const, user: null };
    if (!user.active) return { state: "inactive" as const, user: null };
    return { state: "ok" as const, user };
  },
});

/**
 * Links a Clerk sign-in to a staff record by email address.
 * The very first person to sign in becomes the manager; everyone else must be added by a manager first.
 */
export const link = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Sign in first.");
    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (existing) return { result: existing.active ? ("ok" as const) : ("inactive" as const) };

    const email = identity.email?.toLowerCase().trim();
    const name = identity.name?.trim() || email || "Staff member";

    const anyUser = await ctx.db.query("users").first();
    if (!anyUser) {
      await ctx.db.insert("users", {
        email: email ?? "",
        name,
        role: "manager",
        active: true,
        tokenIdentifier: identity.tokenIdentifier,
      });
      return { result: "ok" as const };
    }

    if (!email) return { result: "not_invited" as const };
    const invited = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!invited || invited.tokenIdentifier) return { result: "not_invited" as const };
    await ctx.db.patch("users", invited._id, {
      tokenIdentifier: identity.tokenIdentifier,
      name: invited.name || name,
    });
    return { result: invited.active ? ("ok" as const) : ("inactive" as const) };
  },
});

export const listStaff = query({
  args: {},
  handler: async (ctx) => {
    await requireManager(ctx);
    const users = await ctx.db.query("users").collect();
    return users
      .map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        active: u.active,
        hasSignedIn: Boolean(u.tokenIdentifier),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
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
      .withIndex("by_email", (q) => q.eq("email", email))
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
