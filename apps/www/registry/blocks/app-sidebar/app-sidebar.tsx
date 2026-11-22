import { formatCurrency, formatDate } from "@/lib/demo/format"
import type { Order, TeamMember } from "@/lib/demo/schema"

import { WorkspaceSidebar } from "./workspace-sidebar"

// The support desk: a sidebar the user can reorder and trim, beside the
// page it opens.
export function AppSidebar({
  user,
  followUps,
}: {
  user: TeamMember | undefined
  followUps: Order[]
}) {
  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-[16rem_1fr]">
      <WorkspaceSidebar user={user} />
      <section
        aria-labelledby="app-sidebar-page"
        className="flex min-w-0 flex-col gap-3 rounded-lg border p-4"
      >
        <div>
          <h3 id="app-sidebar-page" className="font-medium">
            Tickets
          </h3>
          <p className="text-sm text-muted-foreground">
            Customers with an overdue order.
          </p>
        </div>
        <ul className="flex flex-col divide-y text-sm">
          {followUps.map((order) => (
            <li
              key={order.id}
              className="flex items-baseline justify-between gap-2 py-2"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {order.customer}
                </span>
                <span className="text-xs text-muted-foreground">
                  {order.id} · {formatDate(order.createdAt)}
                </span>
              </span>
              <span className="shrink-0 tabular-nums">
                {formatCurrency(order.value)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
