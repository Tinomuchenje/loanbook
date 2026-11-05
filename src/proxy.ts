import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Everything except the sign-in page needs a signed-in Clerk session.
// Who can see what (officer or manager) is enforced again inside every Convex function.
const isPublic = createRouteMatcher(["/sign-in(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
