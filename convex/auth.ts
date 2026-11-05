import { ConvexError } from "convex/values";
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import type { MutationCtx } from "./_generated/server";
import { linkStaffAccount } from "./lib/staffAccounts";

/**
 * Email and password sign-in.
 * Passwords are hashed and stored in Convex (the authAccounts table).
 * Only people on the staff list can create an account; the very first account becomes the manager.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = String(params.email ?? "").trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ConvexError("Enter a valid email address.");
        return { email, name: String(params.name ?? "").trim() };
      },
      validatePasswordRequirements(password) {
        if (password.length < 8) throw new ConvexError("Use at least 8 characters for the password.");
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      if (args.existingUserId) return args.existingUserId;
      return await linkStaffAccount(ctx as unknown as MutationCtx, {
        email: String(args.profile.email ?? ""),
        name: String(args.profile.name ?? ""),
      });
    },
  },
});
