"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/sources", label: "Sources" },
  { href: "/review", label: "Review" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1" aria-label="Main">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm ${active ? "bg-subtle font-medium text-foreground" : "text-muted hover:text-foreground"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
