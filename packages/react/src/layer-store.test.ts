import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { opSchema, type Op, type Overlay } from "@pliantui/contract"

import { createLayerStore, type LayerStoreOptions } from "./layer-store"
import type { StorageAdapter, StoredLayers } from "./storage-adapter"

const surface = "/orders"

function memoryAdapter(stored: StoredLayers = {}) {
  const saved: Overlay[] = []
  const adapter: StorageAdapter = {
    load: () => stored,
    save: (_surface, overlay) => {
      saved.push(overlay)
    },
  }
  return { adapter, saved }
}

function setup(
  stored?: StoredLayers,
  options: Partial<LayerStoreOptions> = {}
) {
  const { adapter, saved } = memoryAdapter(stored)
  const store = createLayerStore({ surface, storage: adapter, ...options })
  const disconnect = store.connect()
  return { store, saved, disconnect }
}

function width(column: string, value: number): Op {
  return {
    op: "setColumnWidth",
    target: `orders-table/columns/${column}`,
    width: value,
  }
}

function widthOf(
  resolved: ReturnType<ReturnType<typeof setup>["store"]["getResolved"]>,
  column: string
) {
  const winner = resolved.properties
    .get(`orders-table/columns/${column}`)
    ?.get("width")?.winner.check.op
  return winner?.op === "setColumnWidth" ? winner.width : undefined
}

function personalOverlay(id: string, ops: unknown[]) {
  return {
    v: 1,
    id,
    surface,
    layer: "personal",
    ops,
    basis: { contract: 1, core: "0.0.0", manifests: {} },
    source: "manual",
    createdBy: "local",
    createdAt: "2026-11-19T00:00:00.000Z",
  }
}

beforeEach(() => {
  vi.useFakeTimers({ now: Date.UTC(2026, 10, 19) })
  sessionStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("createLayerStore", () => {
  it("resolves the stored layers once connected", () => {
    const { adapter } = memoryAdapter({
      personal: [
        personalOverlay("01KAB0000000000000000000P1", [width("total", 240)]),
      ],
    })
    const store = createLayerStore({ surface, storage: adapter })

    expect(widthOf(store.getResolved(), "total")).toBeUndefined()
    store.connect()
    expect(widthOf(store.getResolved(), "total")).toBe(240)
  })

  it("loads layers from an async adapter", async () => {
    const store = createLayerStore({
      surface,
      storage: {
        load: () =>
          Promise.resolve({
            team: [
              {
                ...personalOverlay("01KAB0000000000000000000T1", [
                  width("total", 300),
                ]),
                layer: "team",
                scope: { team: "ops" },
              },
            ],
          }),
        save: () => undefined,
      },
    })
    store.connect()
    await vi.waitFor(() => {
      expect(widthOf(store.getResolved(), "total")).toBe(300)
    })
  })

  it("ignores overlays that don't load and keeps the others", () => {
    const { store } = setup({
      personal: [
        "corrupt",
        { v: 99 },
        personalOverlay("01KAB0000000000000000000P1", [
          width("total", 240),
          { op: "fromTheFuture", target: "orders-table" },
        ]),
      ],
    })
    const resolved = store.getResolved()

    expect(widthOf(resolved, "total")).toBe(240)
    expect(resolved.skipped.map(({ reason }) => reason)).toEqual(["unknown"])
  })

  describe("applyOps", () => {
    it("builds a valid overlay with the given explain", () => {
      const { store } = setup(undefined, {
        generateId: () => "01KAB0000000000000000000A1",
      })
      const result = store.actions.applyOps("session", [width("total", 200)], {
        explain: ["Widen the total column"],
      })

      expect(result).toEqual({
        success: true,
        overlay: {
          v: 1,
          id: "01KAB0000000000000000000A1",
          surface,
          layer: "session",
          ops: [width("total", 200)],
          basis: {
            contract: 1,
            core: expect.any(String) as string,
            manifests: {},
          },
          source: "manual",
          explain: ["Widen the total column"],
          createdBy: "local",
          createdAt: "2026-11-19T00:00:00.000Z",
        },
      })
      expect(widthOf(store.getResolved(), "total")).toBe(200)
    })

    it("rejects an invalid op with the formatted error", () => {
      const { store } = setup()
      const before = store.getResolved()
      const result = store.actions.applyOps("personal", [width("total", 4)])

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("ops[0].width") as string,
      })
      expect(store.getResolved()).toBe(before)
    })

    it("rejects an op the lower layers make invalid", () => {
      const { store } = setup()
      store.registerNodes(["dashboard", "orders"])
      return Promise.resolve().then(() => {
        const result = store.actions.applyOps("personal", [
          opSchema.parse({
            op: "insert",
            target: "dashboard",
            node: { id: "orders", kind: "chart", dataset: "orders" },
            at: { index: 0 },
          }),
        ])

        expect(result).toEqual({
          success: false,
          error: expect.stringContaining(
            "already used on this surface"
          ) as string,
        })
      })
    })

    it("rejects an explain that doesn't match the ops", () => {
      const { store } = setup()
      const result = store.actions.applyOps("personal", [width("total", 200)], {
        explain: [],
      })

      expect(result.success).toBe(false)
    })
  })

  describe("personal coalescing", () => {
    it("coalesces changes to the same property within 1s into one version", () => {
      const { store, saved } = setup()
      const first = store.actions.applyOps("personal", [width("total", 200)])
      vi.advanceTimersByTime(500)
      const second = store.actions.applyOps("personal", [width("total", 220)])
      vi.advanceTimersByTime(900)
      store.actions.applyOps("personal", [width("total", 260)])

      expect(saved).toEqual([])
      expect(widthOf(store.getResolved(), "total")).toBe(260)

      vi.advanceTimersByTime(1000)
      expect(saved).toHaveLength(1)
      expect(first.success && second.success).toBe(true)
      if (first.success) {
        expect(saved[0]).toMatchObject({
          id: first.overlay.id,
          ops: [width("total", 260)],
          createdAt: "2026-11-19T00:00:01.400Z",
        })
      }
    })

    it("starts a new version after 1s", () => {
      const { store, saved } = setup()
      store.actions.applyOps("personal", [width("total", 200)])
      vi.advanceTimersByTime(1000)
      store.actions.applyOps("personal", [width("total", 220)])
      vi.advanceTimersByTime(1000)

      expect(saved.map(({ ops }) => ops)).toEqual([
        [width("total", 200)],
        [width("total", 220)],
      ])
      expect(new Set(saved.map(({ id }) => id)).size).toBe(2)
    })

    it("saves the pending version when another property changes", () => {
      const { store, saved } = setup()
      store.actions.applyOps("personal", [width("total", 200)])
      store.actions.applyOps("personal", [width("status", 120)])

      expect(saved.map(({ ops }) => ops)).toEqual([[width("total", 200)]])
      const resolved = store.getResolved()
      expect(widthOf(resolved, "total")).toBe(200)
      expect(widthOf(resolved, "status")).toBe(120)
    })

    it("flushes the pending version when the page is hidden", () => {
      const { store, saved } = setup()
      store.actions.applyOps("personal", [width("total", 200)])
      window.dispatchEvent(new Event("pagehide"))

      expect(saved.map(({ ops }) => ops)).toEqual([[width("total", 200)]])
      vi.advanceTimersByTime(1000)
      expect(saved).toHaveLength(1)
    })

    it("flushes the pending version on disconnect", () => {
      const { store, saved, disconnect } = setup()
      store.actions.applyOps("personal", [width("total", 200)])
      disconnect()

      expect(saved).toHaveLength(1)
      window.dispatchEvent(new Event("pagehide"))
      expect(saved).toHaveLength(1)
    })

    it("reports a failed save without throwing", () => {
      const error = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined)
      const store = createLayerStore({
        surface,
        storage: {
          load: () => ({}),
          save: () => {
            throw new Error("quota")
          },
        },
      })
      store.connect()
      store.actions.applyOps("personal", [width("total", 200)])
      store.flush()

      expect(error).toHaveBeenCalledWith(new Error("quota"))
      expect(widthOf(store.getResolved(), "total")).toBe(200)
      error.mockRestore()
    })
  })

  describe("session layer", () => {
    it("replaces the session overlay that wrote the same properties", () => {
      const { store } = setup()
      store.actions.applyOps("session", [width("total", 200)])
      store.actions.applyOps("session", [width("status", 120)])
      store.actions.applyOps("session", [width("total", 260)])
      const stored: unknown = JSON.parse(
        sessionStorage.getItem(`pliant:session:${surface}`) ?? "null"
      )

      expect(stored).toMatchObject({
        v: 1,
        overlays: [
          { ops: [width("status", 120)] },
          { ops: [width("total", 260)] },
        ],
        preview: null,
      })
    })

    it("restores the session layer and preview after a reload", () => {
      const first = setup()
      first.store.actions.applyOps("session", [width("total", 200)])
      first.store.actions.preview({
        ...personalOverlay("01KAB0000000000000000000S1", [width("status", 90)]),
        layer: "session",
      })
      first.disconnect()

      const second = setup()
      const resolved = second.store.getResolved()
      expect(widthOf(resolved, "total")).toBe(200)
      expect(widthOf(resolved, "status")).toBe(90)
      expect(second.store.getPreview()?.id).toBe("01KAB0000000000000000000S1")
    })

    it("doesn't touch sessionStorage before it connects", () => {
      const store = createLayerStore({
        surface,
        storage: memoryAdapter().adapter,
      })
      store.actions.applyOps("session", [width("total", 200)])

      expect(sessionStorage.getItem(`pliant:session:${surface}`)).toBeNull()
      store.connect()
      expect(sessionStorage.getItem(`pliant:session:${surface}`)).not.toBeNull()
    })
  })

  describe("preview", () => {
    const answer = {
      ...personalOverlay("01KAB0000000000000000000S1", [width("total", 320)]),
      layer: "session",
      source: "ai",
      explain: ["Widen the total column"],
      createdAt: "2020-01-01T00:00:00.000Z",
    }

    it("applies on top of the session layer until discarded", () => {
      const { store } = setup()
      vi.advanceTimersByTime(10)
      store.actions.applyOps("session", [width("total", 200)])
      const result = store.actions.preview(answer)

      expect(result).toMatchObject({
        success: true,
        overlay: { createdAt: "2026-11-19T00:00:00.011Z" },
      })
      expect(widthOf(store.getResolved(), "total")).toBe(320)
      expect(store.getPreview()?.explain).toEqual(["Widen the total column"])

      store.actions.discard()
      expect(widthOf(store.getResolved(), "total")).toBe(200)
      expect(store.getPreview()).toBeNull()
    })

    it("rejects an overlay for another layer or surface", () => {
      const { store } = setup()

      expect(
        store.actions.preview({ ...answer, layer: "personal" })
      ).toMatchObject({
        success: false,
        error: expect.stringContaining("session") as string,
      })
      expect(
        store.actions.preview({ ...answer, surface: "/invoices" })
      ).toMatchObject({
        success: false,
        error: expect.stringContaining("surface") as string,
      })
      expect(store.getPreview()).toBeNull()
    })

    it("moves the preview to personal on lock in", () => {
      const { store, saved } = setup()
      store.actions.applyOps("personal", [width("status", 100)])
      store.actions.preview(answer)
      const result = store.actions.lockIn()

      expect(result).toMatchObject({
        success: true,
        overlay: {
          layer: "personal",
          source: "ai",
          ops: [width("total", 320)],
          explain: ["Widen the total column"],
        },
      })
      expect(result.success && result.overlay.id).not.toBe(answer.id)
      expect(saved.map(({ ops }) => ops)).toEqual([
        [width("status", 100)],
        [width("total", 320)],
      ])
      expect(store.getPreview()).toBeNull()
      expect(widthOf(store.getResolved(), "total")).toBe(320)
    })

    it("keeps the preview when it can't be locked in", () => {
      const { store, saved } = setup()
      store.actions.preview({
        ...answer,
        ops: [{ op: "setPage", target: "orders-table", index: 2 }],
      })

      expect(store.actions.lockIn().success).toBe(false)
      expect(saved).toEqual([])
      expect(store.getPreview()).not.toBeNull()
    })

    it("has nothing to lock in without a preview", () => {
      const { store } = setup()

      expect(store.actions.lockIn()).toEqual({
        success: false,
        error: "There is no preview to lock in",
      })
    })
  })

  describe("mounted nodes", () => {
    const moveIntoSidebar = opSchema.parse({
      op: "move",
      target: "dashboard/slots/c",
      to: { into: "sidebar" },
    })

    it("applies a dormant op once its container mounts", async () => {
      const { store } = setup()
      store.registerNodes(["dashboard", "c"])
      await Promise.resolve()
      const result = store.actions.applyOps("personal", [moveIntoSidebar])

      expect(result.success).toBe(true)
      expect(store.getResolved().unapplied.map(({ reason }) => reason)).toEqual(
        ["dormant"]
      )

      const unregister = store.registerNodes(["sidebar"])
      await Promise.resolve()
      expect(store.getResolved().unapplied).toEqual([])
      expect(store.getResolved().placements.get("c")?.container).toBe("sidebar")

      unregister()
      await Promise.resolve()
      expect(store.getResolved().unapplied.map(({ reason }) => reason)).toEqual(
        ["dormant"]
      )
    })

    it("batches registrations and ignores ones that change nothing", async () => {
      const { store } = setup()
      const listener = vi.fn()
      store.subscribe(listener)
      store.registerNodes(["a"])
      store.registerNodes(["b"])
      const unregister = store.registerNodes(["a"])
      await Promise.resolve()
      expect(listener).toHaveBeenCalledTimes(1)

      unregister()
      unregister()
      store.registerNodes(["b"])()
      await Promise.resolve()
      expect(listener).toHaveBeenCalledTimes(1)
    })
  })

  describe("getResolved", () => {
    it("returns the same object until something changes", async () => {
      const { store } = setup()
      const first = store.getResolved()

      expect(store.getResolved()).toBe(first)
      store.setTeamOrder([])
      store.registerNodes([])
      await Promise.resolve()
      expect(store.getResolved()).toBe(first)

      store.setTeamOrder(["ops"])
      expect(store.getResolved()).not.toBe(first)
    })

    it("matches the server snapshot until it connects", () => {
      const store = createLayerStore({
        surface,
        storage: memoryAdapter().adapter,
      })

      expect(store.getResolved()).toBe(store.getServerResolved())
    })
  })
})
