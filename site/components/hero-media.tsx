"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/**
 * The looping hero clip is a real recording of the application, so it starts
 * paused behind its own poster frame and only plays once it is on screen.
 * Anyone who prefers reduced motion keeps the still frame.
 */
export function HeroMedia({
  src,
  poster,
  alt,
}: {
  src: string;
  poster: string;
  alt: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || reduced) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void node.play().catch(() => {
            // Autoplay refusal just leaves the poster frame showing.
          });
        } else {
          node.pause();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-frame">
      {reduced ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt={alt} className="block w-full" />
      ) : (
        <video
          ref={ref}
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={alt}
          className="block w-full"
        />
      )}
    </div>
  );
}
