"use client";

import { useEffect, useState } from "react";
import { getReduceMotion } from "@/lib/app-settings";

type SplashScreenProps = {
  onFinish: () => void;
};

const EASE_SETTLE = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const PAGE_DURATION = 480;

const PAGES = [
  { fromX: -260, fromY: -200, fromRot: -75, restRot: -9, restX: -10, delay: 0 },
  { fromX: -90, fromY: -260, fromRot: -45, restRot: -4, restX: -4, delay: 70 },
  { fromX: 90, fromY: -260, fromRot: 45, restRot: 4, restX: 4, delay: 140 },
  { fromX: 260, fromY: -200, fromRot: 75, restRot: 9, restX: 10, delay: 210 },
];
const FACE_CARD_DELAY = 240;
const LANDED_BY = FACE_CARD_DELAY + PAGE_DURATION; // 720ms

const LETTERS = ["F", "o", "l", "i", "o"];

type Phase = "flying" | "drawing" | "wordmark" | "underline" | "holding" | "exiting";

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const [reduced] = useState(() => getReduceMotion());
  const [phase, setPhase] = useState<Phase>(reduced ? "underline" : "flying");
  const [landed, setLanded] = useState(reduced);

  useEffect(() => {
    if (reduced) {
      const t = setTimeout(() => setPhase("exiting"), 350);
      const done = setTimeout(onFinish, 600);
      return () => {
        clearTimeout(t);
        clearTimeout(done);
      };
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    const frames: number[] = [];
    const schedule = (ms: number, fn: () => void) => {
      timers.push(setTimeout(() => frames.push(requestAnimationFrame(fn)), ms));
    };

    frames.push(
      requestAnimationFrame(() => {
        frames.push(requestAnimationFrame(() => setLanded(true)));
      })
    );

    schedule(LANDED_BY + 90, () => setPhase("drawing"));
    schedule(1570, () => setPhase("wordmark"));
    schedule(2070, () => setPhase("underline"));
    schedule(2330, () => setPhase("holding"));
    schedule(2530, () => setPhase("exiting"));
    schedule(2830, onFinish);

    return () => {
      timers.forEach(clearTimeout);
      frames.forEach(cancelAnimationFrame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const drawn = phase === "drawing" || phase === "wordmark" || phase === "underline" || phase === "holding";
  const wordmarkShown = phase === "wordmark" || phase === "underline" || phase === "holding";
  const underlineDrawn = phase === "underline" || phase === "holding";
  const exiting = phase === "exiting";

  return (
    <div
      className="bg-background fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 transition-opacity duration-300"
      style={{ opacity: exiting ? 0 : 1 }}
    >
      <div className="relative h-24 w-24">
        {PAGES.map((p, i) => (
          <div
            key={i}
            className="border-border absolute inset-0 rounded-2xl border bg-white shadow-md"
            style={{
              willChange: "transform, opacity",
              transitionProperty: "transform, opacity",
              transitionDuration: `${PAGE_DURATION}ms`,
              transitionTimingFunction: EASE_SETTLE,
              transitionDelay: `${p.delay}ms`,
              transform: landed
                ? `translate(${p.restX}px, 0px) rotate(${p.restRot}deg)`
                : `translate(${p.fromX}px, ${p.fromY}px) rotate(${p.fromRot}deg) scale(0.7)`,
              opacity: landed ? 1 : 0,
            }}
          />
        ))}

        {/* The face card — same entrance choreography as the background pages, but it stays
            upright and becomes the surface the brand glyph draws itself onto. */}
        <div
          className="bg-brand absolute inset-0 flex items-center justify-center rounded-2xl shadow-lg"
          style={{
            willChange: "transform, opacity",
            transitionProperty: "transform, opacity",
            transitionDuration: `${PAGE_DURATION}ms`,
            transitionTimingFunction: EASE_SETTLE,
            transitionDelay: `${FACE_CARD_DELAY}ms`,
            transform: landed ? "translate(0, 0) rotate(0deg) scale(1)" : "translate(0, -280px) rotate(0deg) scale(0.7)",
            opacity: landed ? 1 : 0,
          }}
        >
          <svg width="40" height="48" viewBox="0 0 40 48" fill="none" className="text-brand-foreground">
            <rect
              x="2"
              y="2"
              width="36"
              height="44"
              rx="6"
              pathLength={1}
              stroke="currentColor"
              strokeWidth="3"
              style={{
                strokeDasharray: 1,
                strokeDashoffset: drawn ? 0 : 1,
                transition: "stroke-dashoffset 500ms ease-out",
              }}
            />
            {[16, 25, 34].map((y, i) => (
              <line
                key={y}
                x1="10"
                y1={y}
                x2={i === 2 ? 24 : 30}
                y2={y}
                pathLength={1}
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                style={{
                  strokeDasharray: 1,
                  strokeDashoffset: drawn ? 0 : 1,
                  transition: `stroke-dashoffset 220ms ease-out ${300 + i * 90}ms`,
                }}
              />
            ))}
          </svg>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <div className="flex text-2xl font-semibold tracking-tight">
          {LETTERS.map((letter, i) => (
            <span
              key={i}
              className="text-foreground"
              style={{
                display: "inline-block",
                willChange: "transform, opacity",
                transitionProperty: "transform, opacity",
                transitionDuration: "260ms",
                transitionTimingFunction: "ease-out",
                transitionDelay: `${i * 45}ms`,
                transform: wordmarkShown ? "translateY(0)" : "translateY(10px)",
                opacity: wordmarkShown ? 1 : 0,
              }}
            >
              {letter}
            </span>
          ))}
        </div>
        <div
          className="bg-brand h-[2.5px] w-14 rounded-full"
          style={{
            willChange: "transform",
            transformOrigin: "left center",
            transform: underlineDrawn ? "scaleX(1)" : "scaleX(0)",
            transition: "transform 260ms ease-out",
          }}
        />
      </div>
    </div>
  );
}
