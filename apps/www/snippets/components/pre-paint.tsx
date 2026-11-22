// #region usage
import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"
import { PliantPrePaint } from "@pliantui/react/pre-paint"

export default function OrdersPage() {
  return (
    <PliantRoot surface="/orders" storage={localAdapter}>
      <PliantPrePaint surface="/orders" />
      {/* Pliant components for this page */}
    </PliantRoot>
  )
}
// #endregion usage
