// Convex checks the sign-in tokens that Convex Auth (convex/auth.ts) issues.
// CONVEX_SITE_URL is set automatically on every Convex deployment.
const authConfig = {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};

export default authConfig;
