"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider, type TokenStorage } from "@convex-dev/auth/react";
import type { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;
const convex = new ConvexReactClient(convexUrl);

/**
 * Every local Convex project runs at http://127.0.0.1:3210, and Convex Auth names its saved
 * session after that address. Prefixing with "loanbook" keeps other projects on localhost:3000
 * from handing their sessions to this app.
 */
const storageNamespace = `loanbook-${convexUrl}`;

/**
 * Browser storage that drops a saved session token this version can't read
 * (a valid refresh token is "<tokenId>|<sessionId>"), instead of failing on every page load.
 */
const storage: TokenStorage = {
  getItem(key) {
    try {
      const value = window.localStorage.getItem(key);
      if (value && key.startsWith("__convexAuthRefreshToken") && !value.includes("|")) {
        window.localStorage.removeItem(key);
        window.localStorage.removeItem(key.replace("__convexAuthRefreshToken", "__convexAuthJWT"));
        return null;
      }
      return value;
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Private browsing or storage blocked: the session lasts until the tab closes.
    }
  },
  removeItem(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing to remove.
    }
  },
};

/** Connects the app to Convex and keeps the email-and-password session in this browser. */
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={convex} storage={storage} storageNamespace={storageNamespace}>
      {children}
    </ConvexAuthProvider>
  );
}
