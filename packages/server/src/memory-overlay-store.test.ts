import { describe } from "vitest"

import { memoryOverlayStore } from "./memory-overlay-store"
import { testOverlayStore } from "./overlay-store-suite"

describe("memoryOverlayStore", () => {
  testOverlayStore(() => Promise.resolve(memoryOverlayStore()))
})
