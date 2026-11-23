// A slim amber strip across the top of a page that shows unfinished work;
// amber dots mark which parts. A page renders it anywhere in its content,
// and it sits above the site header, which makes room for it.
export function UnfinishedStrip() {
  return (
    <div
      role="note"
      data-slot="unfinished-strip"
      // Found by the unfinished work check, which keeps unfinished work out of
      // a build for the production site.
      data-unfinished="not-implemented"
      className="absolute inset-x-0 top-0 flex h-(--unfinished-strip-height) items-center justify-center bg-amber-100 px-4 text-center text-xs font-medium text-amber-950 sm:text-sm dark:bg-amber-950 dark:text-amber-100"
    >
      This page contains unfinished components and work.
    </div>
  )
}
