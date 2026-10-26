import Link from "next/link";
import { Logo } from "./logo";
import { site } from "@/lib/site";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/download", label: "Download", external: false },
      { href: "/roadmap", label: "Roadmap", external: false },
      { href: `${site.repo}/blob/main/CHANGELOG.md`, label: "Changelog", external: true },
    ],
  },
  {
    title: "Documentation",
    links: [
      { href: "/docs/installation", label: "Installation", external: false },
      { href: "/docs/user-guide", label: "User guide", external: false },
      { href: "/docs/keyboard-shortcuts", label: "Shortcuts", external: false },
      { href: "/docs/troubleshooting", label: "Troubleshooting", external: false },
    ],
  },
  {
    title: "Community",
    links: [
      { href: site.repo, label: "GitHub", external: true },
      { href: site.discussions, label: "Discussions", external: true },
      { href: site.issues, label: "Issues", external: true },
      { href: `${site.repo}/blob/main/CONTRIBUTING.md`, label: "Contributing", external: true },
    ],
  },
  {
    title: "Project",
    links: [
      { href: `${site.repo}/blob/main/ARCHITECTURE.md`, label: "Architecture", external: true },
      { href: `${site.repo}/blob/main/SECURITY.md`, label: "Security", external: true },
      { href: `${site.repo}/blob/main/LICENSE`, label: "Licence", external: true },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
              <Logo />
              <span>{site.name}</span>
            </div>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h2 className="text-[13px] font-medium text-tertiary">{column.title}</h2>
              <ul className="mt-4 space-y-2.5 text-sm">
                {column.links.map((link) =>
                  link.external ? (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="link-underline text-secondary transition-colors hover:text-primary"
                      >
                        {link.label}
                      </a>
                    </li>
                  ) : (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="link-underline text-secondary transition-colors hover:text-primary"
                      >
                        {link.label}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t border-border pt-6 text-[13px] text-tertiary sm:flex-row sm:items-center sm:justify-between">
          <p>
            Folio is free software. The application is GPL-3.0; the document engine is
            Apache-2.0.
          </p>
          <p>No accounts. No telemetry. No uploads.</p>
        </div>
      </div>
    </footer>
  );
}
