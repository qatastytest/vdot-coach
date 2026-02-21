"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/performance", label: "Add Performance" },
  { href: "/results", label: "VDOT Results" },
  { href: "/hr-setup", label: "HR Setup" },
  { href: "/goal", label: "Goal Setup" },
  { href: "/plan", label: "Plan" },
  { href: "/settings", label: "Settings" }
];

export function AppNav(): React.JSX.Element {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 md:px-8">
        <Link href="/" className="text-lg font-semibold tracking-tight text-ink">
          VDOT Coach
        </Link>
        <nav className="flex flex-wrap items-center gap-2">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  active ? "bg-accent text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

