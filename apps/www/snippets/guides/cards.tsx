export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  )
}

export function ChartCard({ title }: { title: string }) {
  return (
    <div className="h-64 rounded-xl border p-4">
      <p className="font-medium">{title}</p>
    </div>
  )
}
