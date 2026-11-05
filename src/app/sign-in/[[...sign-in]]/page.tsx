import { SignIn } from "@clerk/nextjs";
import { Logo } from "@/components/logo";

export default function SignInPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <Logo />
        <SignIn forceRedirectUrl="/dashboard" />
        <p className="max-w-sm text-center text-[13px] text-muted">
          Staff only. If you can&apos;t get in, ask your manager to add your email address under Staff.
        </p>
      </div>
    </main>
  );
}
