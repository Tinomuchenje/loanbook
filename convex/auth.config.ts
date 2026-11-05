import type { AuthConfig } from "convex/server";

// Clerk issues the sign-in token; Convex checks it.
// Set CLERK_JWT_ISSUER_DOMAIN on the Convex deployment (see README).
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
