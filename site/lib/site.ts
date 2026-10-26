export const site = {
  name: "Folio",
  tagline: "The modern document workspace.",
  description:
    "Read, edit, organize and protect documents with a desktop experience designed for speed. Open source and local-first. Available for Windows, with macOS and Linux builds from source.",
  url: "https://folio.app",
  repo: "https://github.com/naledisandamela/folio",
  releases: "https://github.com/naledisandamela/folio/releases",
  discussions: "https://github.com/naledisandamela/folio/discussions",
  issues: "https://github.com/naledisandamela/folio/issues",
  version: "0.1.0",
} as const;

/** Direct link to a file attached to the latest GitHub release. */
export const latestAsset = (file: string) =>
  `${site.releases}/latest/download/${file}`;

export const nav = [
  { href: "/#features", label: "Features" },
  { href: "/docs", label: "Docs" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/#community", label: "Community" },
] as const;

export const docsNav = [
  {
    title: "Getting started",
    items: [
      { href: "/docs", label: "Overview" },
      { href: "/docs/installation", label: "Installation" },
      { href: "/docs/user-guide", label: "User guide" },
    ],
  },
  {
    title: "Reference",
    items: [
      { href: "/docs/keyboard-shortcuts", label: "Keyboard shortcuts" },
      { href: "/docs/faq", label: "FAQ" },
      { href: "/docs/troubleshooting", label: "Troubleshooting" },
    ],
  },
] as const;

export type Platform = {
  id: "windows" | "macos" | "linux";
  name: string;
  format: string;
  requirement: string;
  file: string;
  /** False until an installer for this platform is attached to a release. */
  available: boolean;
};

export const platforms: Platform[] = [
  {
    id: "windows",
    name: "Windows",
    format: "NSIS installer",
    requirement: "Windows 10 or later, 64-bit",
    file: `Folio-Setup-${site.version}.exe`,
    available: true,
  },
  {
    id: "macos",
    name: "macOS",
    format: "Disk image",
    requirement: "Apple Silicon and Intel",
    file: `Folio-${site.version}.dmg`,
    available: false,
  },
  {
    id: "linux",
    name: "Linux",
    format: "AppImage",
    requirement: "Most modern distributions",
    file: `Folio-${site.version}.AppImage`,
    available: false,
  },
];
