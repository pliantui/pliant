import { describe, expect, it, vi } from "vitest"

import { createNodeRegistry } from "./node-registry"

describe("createNodeRegistry", () => {
  it("batches mounts to a microtask", async () => {
    const onChange = vi.fn()
    const registry = createNodeRegistry(onChange)

    registry.register(["a"])
    registry.register(["b"])
    expect(registry.ids()).toEqual([])

    await Promise.resolve()
    expect(registry.ids()).toEqual(["a", "b"])
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it("applies a batched update at once on sync", async () => {
    const onChange = vi.fn()
    const registry = createNodeRegistry(onChange)

    registry.register(["a"])
    registry.sync()
    expect(registry.ids()).toEqual(["a"])

    await Promise.resolve()
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it("doesn't call onChange when the ids end up the same", async () => {
    const onChange = vi.fn()
    const registry = createNodeRegistry(onChange)

    const unregister = registry.register(["a"])
    unregister()
    await Promise.resolve()

    expect(registry.ids()).toEqual([])
    expect(onChange).not.toHaveBeenCalled()
  })

  it("keeps an id mounted until every registration of it is gone", async () => {
    const registry = createNodeRegistry(() => undefined)

    const first = registry.register(["a"])
    const second = registry.register(["a"])
    await Promise.resolve()
    first()
    await Promise.resolve()
    expect(registry.ids()).toEqual(["a"])

    second()
    await Promise.resolve()
    expect(registry.ids()).toEqual([])
  })

  it("ignores a second call to the same unregister", async () => {
    const registry = createNodeRegistry(() => undefined)

    const first = registry.register(["a"])
    registry.register(["a"])
    await Promise.resolve()
    first()
    first()
    await Promise.resolve()

    expect(registry.ids()).toEqual(["a"])
  })
})
