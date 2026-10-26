"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/**
 * Counts to the target once, the first time it is seen. Non-numeric values (a
 * licence name, a percentage) are rendered as-is — there is nothing to count.
 */
export function CountUp({ value, duration = 900 }: { value: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState<string | null>(null);
  const reduced = useReducedMotion();

  const numeric = Number(value.replace(/,/g, ""));
  const countable = Number.isFinite(numeric) && numeric > 0;
  // Count in the same precision the value was written in, so 0.9 doesn't
  // arrive as 1 and 5,000 keeps its separator.
  const decimals = value.includes(".") ? value.split(".")[1].length : 0;

  // Pinned to en-US rather than the ambient locale: Node formats with the
  // server's locale and the browser with the user's, which renders "0.0"
  // against "0,0" and fails hydration.
  const format = (n: number) =>
    n.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  useEffect(() => {
    if (!countable || reduced) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplay(format(numeric * eased));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 }
    );
    observer.observe(node);
    return () => observer.disconnect();
    // `format` is derived from `decimals`, which is already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countable, numeric, duration, decimals, reduced]);

  if (!countable) return <span>{value}</span>;

  // Before the animation runs it reads zero; with reduced motion it is simply
  // the final value, never animated.
  return <span ref={ref}>{display ?? (reduced ? value : format(0))}</span>;
}
