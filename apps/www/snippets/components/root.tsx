// #region usage
import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"

export default function OrdersPage() {
  return (
    <PliantRoot surface="/orders" storage={localAdapter}>
      {/* Pliant components for this page */}
    </PliantRoot>
  )
}
// #endregion usage
