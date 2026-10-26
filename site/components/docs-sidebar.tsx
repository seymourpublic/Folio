"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { docsNav } from "@/lib/site";

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Documentation" className="text-sm">
      {docsNav.map((section) => (
        <div key={section.title} className="mb-8">
          <h2 className="mb-3 text-xs font-semibold tracking-wide text-tertiary uppercase">
            {section.title}
          </h2>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`block rounded-lg px-3 py-1.5 transition-colors ${
                      isActive
                        ? "bg-accent-wash font-medium text-accent"
                        : "text-secondary hover:bg-surface-sunken hover:text-primary"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
