import Link from "next/link";
import { requireOwner } from "@/server/session";
import { signOutAction } from "./actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireOwner();

  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="font-semibold tracking-tight">
            StudyForge AI
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-subtle hover:text-foreground">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
