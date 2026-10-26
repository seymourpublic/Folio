import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium " +
  "transition-[transform,box-shadow,background-color,border-color,color] duration-150 ease-out " +
  "will-change-transform motion-reduce:transform-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-background px-5 h-11 shadow-subtle hover:-translate-y-0.5 hover:shadow-lift",
  secondary:
    "border border-border bg-surface text-primary px-5 h-11 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift",
  ghost: "text-secondary px-3 h-11 hover:text-primary",
};

type Props = {
  href: string;
  variant?: Variant;
  external?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function Button({
  href,
  variant = "primary",
  external = false,
  className = "",
  children,
}: Props) {
  const cls = `${base} ${variants[variant]} ${className}`;

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
