import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatCurrency, formatDate } from "@/lib/demo/format"
import type { Order, TeamMember } from "@/lib/demo/schema"
import { PliantRegion } from "@/registry/pliant/pliant-region"

const sharedViews = [
  { name: "Overdue in the South", owner: "Kavya Reddy" },
  { name: "Largest orders this month", owner: "Meera Iyer" },
  { name: "Refunds to review", owner: "Vikram Nair" },
]

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
}

// The sales team's shared page: who's on the team, what changed lately and
// the views they share. Members can rearrange its panels.
export function TeamWorkspace({
  members,
  activity,
  published,
}: {
  members: TeamMember[]
  activity: Order[]
  // Whether the layout shows as the team's published default.
  published: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      {published && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">Team default</Badge>
          Everyone in Sales sees this layout until they change it.
        </p>
      )}
      <PliantRegion
        id="team-workspace"
        className="grid gap-4 lg:grid-cols-3"
        slots={{
          members: (
            <Card className="gap-4">
              <CardHeader>
                <CardTitle>Members</CardTitle>
                <CardDescription>{members.length} people</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-3">
                  {members.map((member) => (
                    <li key={member.email} className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium"
                      >
                        {initials(member.name)}
                      </span>
                      <span className="flex min-w-0 flex-col text-sm leading-tight">
                        <span className="truncate font-medium">
                          {member.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {member.team}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ),
          activity: (
            <Card className="gap-4">
              <CardHeader>
                <CardTitle>Activity</CardTitle>
                <CardDescription>The latest orders.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-3 text-sm">
                  {activity.map((order) => (
                    <li
                      key={order.id}
                      className="flex items-baseline justify-between gap-2"
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
              </CardContent>
            </Card>
          ),
          "shared-views": (
            <Card className="gap-4">
              <CardHeader>
                <CardTitle>Shared views</CardTitle>
                <CardDescription>Saved by the team.</CardDescription>
                <CardAction>
                  <Badge variant="secondary">{sharedViews.length}</Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-3 text-sm">
                  {sharedViews.map((view) => (
                    <li key={view.name} className="flex flex-col">
                      <span className="font-medium">{view.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {view.owner}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ),
        }}
      />
    </div>
  )
}
