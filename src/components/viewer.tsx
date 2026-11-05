"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { SignOutButton, useUser } from "@clerk/nextjs";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
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

/**
 * Waits for Clerk and Convex, links the Clerk sign-in to a staff record,
 * and only shows the app to active staff.
 */
export function ViewerGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const link = useMutation(api.users.link);
  const [linkResult, setLinkResult] = useState<"not_invited" | "inactive" | "error" | null>(null);
  const linking = useRef(false);

  useEffect(() => {
    if (me?.state !== "needs_link" || linking.current) return;
    linking.current = true;
    link({})
      .then((r) => r.result !== "ok" && setLinkResult(r.result))
      .catch(() => setLinkResult("error"))
      .finally(() => (linking.current = false));
  }, [me?.state, link]);

  if (isLoading || (isAuthenticated && me === undefined)) return <FullScreen><Loading label="Opening the loan book…" /></FullScreen>;
  if (!isAuthenticated || me?.state === "signed_out") {
    return (
      <FullScreen>
        <Loading label="Checking your sign-in…" />
      </FullScreen>
    );
  }
  if (me?.state === "inactive" || linkResult === "inactive") {
    return <NoAccess title="Your access is switched off" body="Ask your manager to switch your account back on." />;
  }
  if (linkResult === "not_invited") {
    return <NotInvited />;
  }
  if (linkResult === "error") {
    return <NoAccess title="We couldn't set up your account" body="Reload the page to try again." />;
  }
  if (me?.state !== "ok" || !me.user) return <FullScreen><Loading label="Setting up your account…" /></FullScreen>;
  return <ViewerContext.Provider value={me.user}>{children}</ViewerContext.Provider>;
}

function FullScreen({ children }: { children: ReactNode }) {
  return <div className="grid min-h-screen place-items-center">{children}</div>;
}

function NotInvited() {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  return (
    <NoAccess
      title="You're not on the staff list yet"
      body={
        <>
          Ask your manager to add <strong className="text-ink">{email ?? "your email address"}</strong> under Staff,
          then reload this page.
        </>
      }
    />
  );
}

function NoAccess({ title, body }: { title: string; body: ReactNode }) {
  return (
    <FullScreen>
      <div className="mx-4 max-w-md rounded-card border border-line bg-surface p-6 text-center">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted">{body}</p>
        <div className="mt-5">
          <SignOutButton>
            <button className={buttonClass("secondary")}>Sign out</button>
          </SignOutButton>
        </div>
      </div>
    </FullScreen>
  );
}
