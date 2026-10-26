import Image from "next/image";

/**
 * A product capture, shown as itself. No browser chrome, no device frame — just
 * a hairline border so the near-white application edge separates from the page.
 */
export function Screenshot({
  src,
  darkSrc,
  alt,
  priority = false,
  className = "",
}: {
  src: string;
  darkSrc?: string;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-border bg-surface shadow-frame ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        width={2360}
        height={1480}
        priority={priority}
        sizes="(max-width: 1024px) 100vw, 720px"
        className={`block w-full ${darkSrc ? "dark:hidden" : ""}`}
      />
      {darkSrc ? (
        <Image
          src={darkSrc}
          alt=""
          aria-hidden="true"
          width={2360}
          height={1480}
          priority={priority}
          sizes="(max-width: 1024px) 100vw, 720px"
          className="hidden w-full dark:block"
        />
      ) : null}
    </div>
  );
}
