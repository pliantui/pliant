// #region nonce
import { headers } from "next/headers"

import { PliantPrePaint } from "@pliantui/react/pre-paint"

export async function OrdersPrePaint() {
  const nonce = (await headers()).get("x-nonce") ?? undefined
  return <PliantPrePaint surface="/orders" nonce={nonce} />
}
// #endregion nonce
