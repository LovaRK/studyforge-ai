import type { Metadata } from "next";
import { BrandMark } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · StudyForge AI" };

export default function LoginPage() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16">
      <div className="blob -left-24 top-10 size-80 bg-accent/30" aria-hidden="true" />
      <div className="blob -right-20 bottom-0 size-96 bg-accent-2/25 [animation-delay:-7s]" aria-hidden="true" />
      <div className="page-enter relative w-full max-w-sm">
        <div className="space-y-6">
          <div className="space-y-3 text-center">
            <BrandMark className="mx-auto size-12" />
            <h1 className="text-2xl font-semibold tracking-tight">StudyForge AI</h1>
            <p className="text-sm text-muted">Private study space. Sign in to continue.</p>
          </div>
          <div className="rounded-2xl border border-line bg-surface/80 p-6 shadow-xl backdrop-blur-xl">
            <LoginForm />
          </div>
          <p className="text-center text-xs text-muted">Every card is checked word for word against your own notes.</p>
        </div>
      </div>
    </main>
  );
}
