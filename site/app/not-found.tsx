import type { Metadata } from "next";
import { Button } from "@/components/button";

export const metadata: Metadata = {
  title: "Page not found",
  description: "That page does not exist.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 py-section text-center">
      <p className="font-mono text-[11px] tracking-widest text-tertiary uppercase">
        404
      </p>
      <h1 className="mt-4 text-4xl font-semibold">This page does not exist</h1>
      <p className="mt-5 leading-relaxed text-secondary">
        The link may be out of date, or the page may have moved. The documentation index
        is a good place to pick the thread back up.
      </p>
      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <Button href="/">Back to home</Button>
        <Button href="/docs" variant="secondary">
          Documentation
        </Button>
      </div>
    </div>
  );
}
