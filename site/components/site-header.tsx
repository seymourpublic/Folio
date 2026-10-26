"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { nav, site } from "@/lib/site";

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  // The blur and hairline only appear once the page has moved, so the header
  // sits flat against the hero at rest.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-200 ${
        scrolled
          ? "border-b border-border bg-background/75 backdrop-blur-lg"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight"
        >
          <Logo />
          <span>{site.name}</span>
        </Link>

        <nav className="ml-auto flex items-center gap-1 text-sm">
          <div className="hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="link-underline px-3 py-2 text-secondary transition-colors hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
            <a
              href={site.repo}
              target="_blank"
              rel="noreferrer"
              className="link-underline px-3 py-2 text-secondary transition-colors hover:text-primary"
            >
              GitHub
            </a>
          </div>

          <ThemeToggle />

          <Link
            href="/download"
            className="ml-2 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-background transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-lift motion-reduce:transform-none"
          >
            Download
          </Link>
        </nav>
      </div>
    </header>
  );
}
