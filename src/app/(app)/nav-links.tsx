"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const LINKS = [
  { href: "/quiz", label: "Quiz" },
  { href: "/sources", label: "Sources" },
  { href: "/review", label: "Review" },
  { href: "/library", label: "Library" },
  { href: "/flashcards", label: "Flashcards" },
  { href: "/study", label: "Study" },
];

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
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${active ? "bg-subtle font-medium text-foreground" : "text-muted hover:text-foreground"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
