import { DocsSidebar } from "@/components/docs-sidebar";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl gap-16 px-6 py-20 lg:grid lg:grid-cols-[200px_minmax(0,1fr)]">
      <aside className="mb-10 lg:mb-0">
        <div className="lg:sticky lg:top-24">
          <DocsSidebar />
        </div>
      </aside>
      <div className="min-w-0 max-w-2xl">{children}</div>
    </div>
  );
}
