"use client";

import { useEffect, useRef, useState } from "react";

type UseIntersectionObserverOptions = IntersectionObserverInit & {
  /** When true (the default), the element stays reported as intersecting after its first
   * intersection. Pass `sticky: false` to observe exits too. */
  sticky?: boolean;
};

export function useIntersectionObserver<T extends HTMLElement>(
  options: UseIntersectionObserverOptions = { rootMargin: "800px 0px" }
) {
  const { sticky = true, ...observerInit } = options;
  const ref = useRef<T | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting || !sticky) {
        setIsIntersecting(entry.isIntersecting);
      }
    }, observerInit);

    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, isIntersecting };
}
