import Link from "next/link";
import { requireOwner } from "@/server/session";
import { signOutAction } from "./actions";
import { NavLinks } from "./nav-links";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireOwner();

  return (
    <>
      <header className="border-b border-line bg-surface">
        {/* Phones: brand and sign-out on one row, the nav on its own full-width row below. */}
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5">
          <Link href="/" className="shrink-0 whitespace-nowrap font-semibold tracking-tight">
            StudyForge AI
          </Link>
          <div className="order-last -mx-3 w-[calc(100%+1.5rem)] min-w-0 sm:order-none sm:mx-0 sm:w-auto sm:flex-1">
            <NavLinks />
          </div>
          <form action={signOutAction} className="shrink-0">
            <button
              type="submit"
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted hover:bg-subtle hover:text-foreground"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
