/**
 * Shared typography for documentation pages. Styles descendants by element so
 * page bodies stay plain markup.
 */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="
        max-w-none
        [&_h2]:mt-12 [&_h2]:scroll-mt-24 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight
        [&_h3]:mt-8 [&_h3]:scroll-mt-24 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:tracking-tight
        [&_p]:mt-4 [&_p]:leading-relaxed [&_p]:text-secondary
        [&_ul]:mt-4 [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:marker:text-tertiary
        [&_ol]:mt-4 [&_ol]:space-y-2 [&_ol]:pl-5 [&_ol]:list-decimal [&_ol]:marker:text-tertiary
        [&_li]:leading-relaxed [&_li]:text-secondary
        [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4
        [&_strong]:font-semibold [&_strong]:text-primary
        [&_code]:rounded [&_code]:border [&_code]:border-border [&_code]:bg-surface-sunken
        [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]
        [&_pre]:mt-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border
        [&_pre]:bg-surface [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-sm
        [&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[1em]
        [&_kbd]:rounded [&_kbd]:border [&_kbd]:border-border [&_kbd]:bg-surface-sunken
        [&_kbd]:px-1.5 [&_kbd]:py-0.5 [&_kbd]:font-mono [&_kbd]:text-xs [&_kbd]:text-primary
        [&_table]:mt-5 [&_table]:w-full [&_table]:text-left [&_table]:text-sm
        [&_th]:border-b [&_th]:border-border [&_th]:pb-2 [&_th]:font-semibold
        [&_td]:border-b [&_td]:border-border [&_td]:py-2.5 [&_td]:align-top
        [&_td]:text-secondary
      "
    >
      {children}
    </div>
  );
}

export function Callout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="mt-6 rounded-xl border border-border bg-surface p-5">
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-1.5 text-sm leading-relaxed text-secondary">
        {children}
      </div>
    </aside>
  );
}
