import { PliantPrePaint } from "@pliantui/react/pre-paint"

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <PliantPrePaint surface="/reports" />
      {children}
    </>
  )
}
