export function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p>{label}</p>
      <p>{value}</p>
    </div>
  )
}
