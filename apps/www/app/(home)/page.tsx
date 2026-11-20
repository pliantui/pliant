import Link from "next/link"

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Pliant</h1>
      <p className="max-w-md text-fd-muted-foreground">
        Let the users of your shadcn app reshape it to fit their work.
      </p>
      <Link href="/docs" className="font-medium underline underline-offset-4">
        Read the docs
      </Link>
    </main>
  )
}
