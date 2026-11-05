"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { ConvexError } from "convex/values";
import { Logo } from "@/components/logo";
import { Button, Field, FormError, Input, Loading } from "@/components/ui";

type Mode = "signIn" | "signUp";

function friendlyError(err: unknown, mode: Mode): string {
  if (err instanceof ConvexError) return String(err.data);
  const message = err instanceof Error ? err.message : "";
  if (/already exists/i.test(message)) return "There's already an account for this email. Sign in instead.";
  if (mode === "signIn")
    return "That email and password don't match. Check them and try again, or ask your manager to reset your password.";
  return "We couldn't create the account. Check your details and try again.";
}

export default function SignInPage() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<Mode>("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "signUp" && password.length < 8) return setError("Use at least 8 characters for the password.");
    setBusy(true);
    try {
      await signIn("password", { flow: mode, email, password, ...(mode === "signUp" ? { name } : {}) });
      router.replace("/dashboard");
    } catch (err) {
      setError(friendlyError(err, mode));
      setBusy(false);
    }
  }

  function switchTo(next: Mode) {
    setMode(next);
    setError(null);
  }

  if (isLoading || isAuthenticated) {
    return (
      <main className="grid min-h-screen place-items-center">
        <Loading label="Checking your sign-in…" />
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center">
          <Logo />
        </div>
        <div className="rounded-card border border-line bg-surface p-6">
          <h1 className="text-xl font-semibold">{mode === "signIn" ? "Sign in" : "Create your account"}</h1>
          <p className="mt-1 text-sm text-muted">
            {mode === "signIn"
              ? "Use the email address your manager added for you."
              : "Use the email address your manager added under Staff."}
          </p>
          <form onSubmit={submit} className="mt-5 grid gap-4">
            {mode === "signUp" && (
              <Field label="Your name" htmlFor="name">
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
            )}
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </Field>
            <Field label="Password" htmlFor="password" hint={mode === "signUp" ? "At least 8 characters" : undefined}>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                required
              />
            </Field>
            <FormError message={error} />
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? (mode === "signIn" ? "Signing in…" : "Creating account…") : mode === "signIn" ? "Sign in" : "Create account"}
            </Button>
          </form>
        </div>
        <p className="text-center text-[13px] text-muted">
          {mode === "signIn" ? (
            <>
              First time here?{" "}
              <button type="button" onClick={() => switchTo("signUp")} className="font-medium text-brand hover:underline">
                Create your account
              </button>
              <span className="mt-1 block">The very first account becomes the manager.</span>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => switchTo("signIn")} className="font-medium text-brand hover:underline">
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
