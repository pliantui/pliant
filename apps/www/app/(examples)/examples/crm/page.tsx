import type { Metadata } from "next"

import { CrmPipelineDemo } from "@/components/blocks/crm-pipeline-demo"
import { deals } from "@/lib/demo/data"
import { formatCurrency } from "@/lib/demo/format"

export const metadata: Metadata = {
  title: "CRM",
  alternates: { canonical: "/examples/crm" },
}

export default function CrmPage() {
  const open = deals.filter((deal) => deal.stage !== "won")

  return (
    <div className="flex-1 bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 lg:px-6">
        <header className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">Pipeline</h2>
          <p className="text-sm text-muted-foreground">
            {open.length} open deals worth{" "}
            {formatCurrency(open.reduce((sum, deal) => sum + deal.value, 0))}
          </p>
        </header>
        <CrmPipelineDemo deals={deals} />
      </div>
    </div>
  )
}
