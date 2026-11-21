import { usePliantRegion } from "@pliantui/react/region"

export function useHookedRegion() {
  return usePliantRegion("hooked", { one: <p>One</p>, two: <p>Two</p> })
}
