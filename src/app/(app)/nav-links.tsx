"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/sources", label: "Sources" },
  { href: "/review", label: "Review" },
  { href: "/library", label: "Library" },
  { href: "/flashcards", label: "Flashcards" },
  { href: "/quiz", label: "Quiz" },
  { href: "/study", label: "Study" },
];

/** A pulsing dot on the link being opened, so a slow page never feels unresponsive. */
function PendingDot() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={`absolute right-1 top-1 size-1.5 rounded-full bg-accent transition-opacity ${pending ? "animate-ping opacity-100" : "opacity-0"}`}
    />
  );
}

export function NavLinks() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  // On narrow screens the nav scrolls sideways; keep the current page's link in view.
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  return (
    <nav ref={navRef} className="flex min-w-0 items-center gap-1 overflow-x-auto" aria-label="Main">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition duration-150 ${active ? "bg-accent/10 font-medium text-accent shadow-[inset_0_0_0_1px] shadow-accent/25" : "text-muted hover:bg-subtle hover:text-foreground"}`}
          >
            {label}
            <PendingDot />
          </Link>
        );
      })}
    </nav>
  );
}
