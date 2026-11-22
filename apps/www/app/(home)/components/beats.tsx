import { BlocksIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react"

const beats = [
  {
    icon: SparklesIcon,
    title: "Users reshape your app",
    description:
      "They sort, hide, move and resize what you built, by hand or by pointing at it and asking. Each change saves for that user, or for their team.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Safe by design",
    description:
      "You decide what can change, for whom. Guardrails check every change, and the AI never writes code or queries: it picks from the operations you allow.",
  },
  {
    icon: BlocksIcon,
    title: "Built on your shadcn components",
    description:
      "Pliant components wrap the shadcn components you already use, like tables, forms and sidebars. They install with the shadcn CLI as code you own.",
  },
]

export function Beats() {
  return (
    <section
      aria-labelledby="beats-heading"
      className="container-wrapper border-t"
    >
      <div className="container py-12 md:py-16">
        <h2 id="beats-heading" className="sr-only">
          Why Pliant
        </h2>
        <ul className="grid gap-8 md:grid-cols-3 md:gap-10">
          {beats.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex flex-col gap-2">
              <Icon
                aria-hidden="true"
                className="size-5 text-muted-foreground"
              />
              <h3 className="font-medium">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
