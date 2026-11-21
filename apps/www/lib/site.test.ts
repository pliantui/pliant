import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"

async function loadSite() {
  vi.resetModules()
  const { site } = await import("@/lib/site")
  return site
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("site.url", () => {
  it("defaults to the deployed site", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "")
    expect((await loadSite()).url).toBe(
      "https://pliantui-www.pliantui-dev.workers.dev"
    )
  })

  it("reads NEXT_PUBLIC_SITE_URL without a trailing slash", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com/")
    expect((await loadSite()).url).toBe("https://example.com")
  })

  it("is the registry's homepage", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "")
    const registry: unknown = JSON.parse(
      readFileSync(new URL("../registry.json", import.meta.url), "utf8")
    )
    expect(registry).toMatchObject({ homepage: (await loadSite()).url })
  })
})
