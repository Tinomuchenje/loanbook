"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { LogOut } from "lucide-react";
import { Loading, buttonClass } from "./ui";

const ViewerContext = createContext<Doc<"users"> | null>(null);

export function useViewer() {
  const viewer = useContext(ViewerContext);
  if (!viewer) throw new Error("useViewer must be used inside <ViewerGate>");
  return viewer;
}

export function useIsManager() {
  return useViewer().role === "manager";
}

/** Sends signed-out visitors to /sign-in and only shows the app to active staff. */
export function ViewerGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const signedOut = !isLoading && (!isAuthenticated || me?.state === "signed_out");

  useEffect(() => {
    if (signedOut) router.replace("/sign-in");
  }, [signedOut, router]);

  if (me?.state === "inactive") {
    return <NoAccess title="Your access is switched off" body="Ask your manager to switch your account back on." />;
  }
  if (me?.state !== "ok" || !me.user) {
    return (
      <FullScreen>
        <Loading label={signedOut ? "Taking you to sign in…" : "Opening the loan book…"} />
      </FullScreen>
    );
  }
  return <ViewerContext.Provider value={me.user}>{children}</ViewerContext.Provider>;
}

export function SignOutButton({ className, iconOnly }: { className?: string; iconOnly?: boolean }) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  return (
    <button
      type="button"
      className={className ?? buttonClass("secondary")}
      aria-label="Sign out"
      title="Sign out"
      onClick={async () => {
        await signOut();
        router.replace("/sign-in");
      }}
    >
      {iconOnly ? <LogOut size={17} /> : "Sign out"}
    </button>
  );
}

function FullScreen({ children }: { children: ReactNode }) {
  return <div className="grid min-h-screen place-items-center">{children}</div>;
}

function NoAccess({ title, body }: { title: string; body: ReactNode }) {
  return (
    <FullScreen>
      <div className="mx-4 max-w-md rounded-card border border-line bg-surface p-6 text-center">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted">{body}</p>
        <div className="mt-5">
          <SignOutButton />
        </div>
      </div>
    </FullScreen>
  );
}
