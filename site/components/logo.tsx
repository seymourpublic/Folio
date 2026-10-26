export function Logo({ className = "size-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
      role="presentation"
    >
      <rect width="32" height="32" rx="7" fill="var(--primary)" />
      <path
        d="M11 9.5h10.5M11 16h7.5M11 9.5v13"
        stroke="var(--background)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
