import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { opSchema, type Op, type Overlay } from "@pliantui/contract"

import {
  memoryStorage,
  recordOf,
  stored,
  type StoredInput,
} from "../test/storage"
import { createLayerStore, type LayerStoreOptions } from "./layer-store"
import { localAdapter } from "./local-adapter"
import type { StorageAdapter } from "./storage-adapter"

const surface = "/orders"

function setup(layers?: StoredInput, options: Partial<LayerStoreOptions> = {}) {
  const { storage, saved } = memoryStorage(layers)
  const store = createLayerStore({ surface, storage, ...options })
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
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("createLayerStore", () => {
  it("resolves the stored layers once connected", () => {
    const { storage } = memoryStorage({
      personal: [
        personalOverlay("01KAB0000000000000000000P1", [width("total", 240)]),
      ],
    })
    const store = createLayerStore({ surface, storage })

    expect(widthOf(store.getResolved(), "total")).toBeUndefined()
    store.connect()
    expect(widthOf(store.getResolved(), "total")).toBe(240)
  })

  it("loads layers from an async adapter", async () => {
    const store = createLayerStore({
      surface,
      storage: {
        ...memoryStorage().storage,
        load: () =>
          Promise.resolve({
            team: stored({
              ...personalOverlay("01KAB0000000000000000000T1", [
                width("total", 300),
              ]),
              layer: "team",
              scope: { team: "ops" },
            }),
          }),
      },
    })
    store.connect()
    await vi.waitFor(() => {
      expect(widthOf(store.getResolved(), "total")).toBe(300)
    })
  })

  it("ignores overlays that don't load and keeps the others", () => {
    localStorage.setItem(
      `pliant:${surface}:01KAB0000000000000000000P8`,
      "corrupt"
    )
    localStorage.setItem(
      `pliant:${surface}:01KAB0000000000000000000P9`,
      JSON.stringify({ overlay: { v: 99 }, etag: "1" })
    )
    localStorage.setItem(
      `pliant:${surface}:01KAB0000000000000000000P1`,
      JSON.stringify(
        recordOf(
          personalOverlay("01KAB0000000000000000000P1", [
            width("total", 240),
            { op: "fromTheFuture", target: "orders-table" },
          ])
        )
      )
    )
    const store = createLayerStore({ surface, storage: localAdapter() })
    store.connect()
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

    describe("lang", () => {
      afterEach(() => {
        document.documentElement.removeAttribute("lang")
      })

      it("records the page's language", () => {
        document.documentElement.lang = "fr-CA"
        const { store } = setup()
        const result = store.actions.applyOps("personal", [width("total", 200)])

        expect(result.success && result.overlay.lang).toBe("fr-CA")
      })

      it.each([
        "",
        "en_US",
        "de-DE-u-co-phonebk-ca-gregory-nu-latn-hc-h23-fw-mon-ms-metric-tz-deber",
      ])("leaves out a page language of %j", (lang) => {
        document.documentElement.lang = lang
        const { store } = setup()
        const result = store.actions.applyOps("personal", [width("total", 200)])

        expect(result.success && "lang" in result.overlay).toBe(false)
        expect(result.success).toBe(true)
      })

      it("prefers the lang option to the page's language", () => {
        document.documentElement.lang = "en"
        const { store } = setup(undefined, { lang: "fr-CA" })
        const first = store.actions.applyOps("personal", [width("total", 200)])
        store.setLang("de")
        const second = store.actions.applyOps("session", [width("total", 220)])

        expect(first.success && first.overlay.lang).toBe("fr-CA")
        expect(second.success && second.overlay.lang).toBe("de")
      })

      it("ignores a malformed lang option with a warning", () => {
        const warn = vi
          .spyOn(console, "warn")
          .mockImplementation(() => undefined)
        document.documentElement.lang = "en"
        const { store } = setup(undefined, { lang: "en_US" })
        const result = store.actions.applyOps("personal", [width("total", 200)])

        expect(result.success && result.overlay.lang).toBe("en")
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("en_US"))
        warn.mockRestore()
      })
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

    it("checks ids against nodes mounted in the same tick", () => {
      const { store } = setup()
      store.registerNodes(["dashboard", "orders"])
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

    it("sorts after saved overlays from a clock that was ahead", () => {
      const { store } = setup({
        personal: [
          {
            ...personalOverlay("01KAB0000000000000000000P1", [
              width("total", 500),
            ]),
            createdAt: "2030-01-01T00:00:00.000Z",
          },
        ],
      })
      const result = store.actions.applyOps("personal", [width("total", 200)])

      expect(result).toMatchObject({
        overlay: { createdAt: "2030-01-01T00:00:00.001Z" },
      })
      expect(widthOf(store.getResolved(), "total")).toBe(200)
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

    it.each(["personal", "session"] as const)(
      "never coalesces %s placements, insertions or removals",
      async (layer) => {
        const { store } = setup()
        store.registerNodes(["dashboard", "sidebar", "a", "b"])
        await Promise.resolve()
        store.actions.applyOps(layer, [
          opSchema.parse({
            op: "move",
            target: "dashboard/slots/a",
            to: { into: "sidebar" },
          }),
        ])
        store.actions.applyOps(layer, [
          opSchema.parse({
            op: "pin",
            target: "dashboard/slots/a",
            where: "start",
          }),
        ])
        store.actions.applyOps(layer, [
          opSchema.parse({
            op: "insert",
            target: "dashboard",
            node: { id: "ins1", kind: "chart", dataset: "orders" },
            at: { index: 0 },
          }),
        ])
        store.actions.applyOps(layer, [
          opSchema.parse({ op: "remove", target: "ins1" }),
        ])
        const resolved = store.getResolved()

        expect(resolved.placements.get("a")).toMatchObject({
          container: "sidebar",
          position: { pin: "start" },
        })
        expect(
          resolved.properties.get("ins1")?.get("inserted")?.winner.check.op.op
        ).toBe("remove")
        expect(
          resolved.overlays.filter((overlay) => overlay.layer === layer)
        ).toHaveLength(4)
      }
    )

    it("reports a failed save and saves it again on the next flush", () => {
      const onError = vi.fn()
      const saved: Overlay[] = []
      let failing = true
      const store = createLayerStore({
        surface,
        onError,
        storage: {
          ...memoryStorage().storage,
          save: (_surface, overlay) => {
            if (failing) {
              throw new Error("quota")
            }
            saved.push(overlay)
            return recordOf(overlay)
          },
        },
      })
      store.connect()
      store.actions.applyOps("personal", [width("total", 200)])
      store.flush()

      expect(onError).toHaveBeenCalledWith(new Error("quota"))
      expect(widthOf(store.getResolved(), "total")).toBe(200)

      failing = false
      store.flush()
      expect(saved.map(({ ops }) => ops)).toEqual([[width("total", 200)]])
    })

    it("reports the same failure once while retrying", () => {
      const onError = vi.fn()
      const save = vi.fn<StorageAdapter["save"]>(() => {
        throw new Error("newer data")
      })
      const store = createLayerStore({
        surface,
        onError,
        storage: { ...memoryStorage().storage, save },
      })
      store.connect()
      store.actions.applyOps("personal", [width("total", 200)])
      store.flush()
      store.flush()
      store.flush()
      expect(save).toHaveBeenCalledTimes(3)
      expect(onError).toHaveBeenCalledTimes(1)

      save.mockImplementationOnce(() => {
        throw new Error("quota")
      })
      store.flush()
      expect(onError).toHaveBeenCalledTimes(2)
      expect(onError).toHaveBeenLastCalledWith(new Error("quota"))
    })

    it("saves a rejected async save again on the next flush", async () => {
      const onError = vi.fn()
      const save = vi
        .fn<StorageAdapter["save"]>()
        .mockRejectedValueOnce(new Error("offline"))
        .mockImplementation((_surface, overlay) =>
          Promise.resolve(recordOf(overlay))
        )
      const store = createLayerStore({
        surface,
        onError,
        storage: { ...memoryStorage().storage, save },
      })
      store.connect()
      store.actions.applyOps("personal", [width("total", 200)])
      store.flush()
      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalledWith(new Error("offline"))
      })

      store.flush()
      expect(save).toHaveBeenCalledTimes(2)
      expect(save.mock.calls[1]?.[1]).toMatchObject({
        ops: [width("total", 200)],
      })
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

    it("doesn't touch storage before it connects", () => {
      const load = vi.fn(() => ({}))
      const store = createLayerStore({
        surface,
        storage: { ...memoryStorage().storage, load },
      })

      expect(store.getStatus()).toEqual({ status: "loading" })
      expect(sessionStorage.getItem(`pliant:session:${surface}`)).toBeNull()
      expect(load).not.toHaveBeenCalled()

      store.connect()
      expect(store.getStatus()).toEqual({ status: "ready" })
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
      expect(result.success && result.overlay?.id).not.toBe(answer.id)
      expect(saved.map(({ ops }) => ops)).toEqual([
        [width("status", 100)],
        [width("total", 320)],
      ])
      expect(store.getPreview()).toBeNull()
      expect(widthOf(store.getResolved(), "total")).toBe(320)
    })

    it("drops session changes that would hide the locked version", () => {
      const { store } = setup()
      store.actions.applyOps("session", [
        width("total", 100),
        width("status", 80),
      ])
      store.actions.applyOps("session", [width("total", 110)], {
        explain: ["Narrow the total column"],
      })
      store.actions.preview(answer)
      store.actions.lockIn()

      const resolved = store.getResolved()
      expect(widthOf(resolved, "total")).toBe(320)
      expect(widthOf(resolved, "status")).toBe(80)
      expect(
        JSON.parse(
          sessionStorage.getItem(`pliant:session:${surface}`) ?? "null"
        )
      ).toMatchObject({
        overlays: [{ ops: [width("status", 80)] }],
        preview: null,
      })
    })

    it("keeps session-only ops in the session layer", () => {
      const { store, saved } = setup()
      const page = { op: "setPage", target: "orders-table", index: 2 }
      store.actions.preview({
        ...answer,
        ops: [width("total", 320), page],
        explain: ["Widen the total column", "Go to page 3"],
      })
      const result = store.actions.lockIn()

      expect(result).toMatchObject({
        success: true,
        overlay: { layer: "personal", ops: [width("total", 320)] },
        keptInSession: [page],
      })
      expect(saved).toMatchObject([
        { ops: [width("total", 320)], explain: ["Widen the total column"] },
      ])
      expect(
        store.getResolved().properties.get("orders-table")?.get("page")?.winner
          .overlay.layer
      ).toBe("session")
      expect(store.getPreview()).toBeNull()
    })

    it("moves a preview of session-only ops to the session layer", () => {
      const { store, saved } = setup()
      store.actions.preview({
        ...answer,
        ops: [{ op: "setPage", target: "orders-table", index: 2 }],
      })

      expect(store.actions.lockIn()).toEqual({
        success: true,
        overlay: null,
        keptInSession: [{ op: "setPage", target: "orders-table", index: 2 }],
      })
      expect(saved).toEqual([])
      expect(store.getPreview()).toBeNull()
    })

    it("keeps ops that depend on the session layer in it", async () => {
      const { store, saved } = setup()
      store.registerNodes(["dashboard", "a", "b", "c"])
      await Promise.resolve()
      store.actions.applyOps("session", [
        opSchema.parse({
          op: "wrap",
          target: "dashboard",
          id: "box",
          items: ["a", "b"],
          mode: "row",
        }),
      ])
      const move = opSchema.parse({
        op: "move",
        target: "dashboard/slots/c",
        to: { into: "box" },
      })
      store.actions.preview({
        ...answer,
        ops: [width("total", 320), move],
        explain: ["Widen the total column", "Move c into the box"],
      })
      expect(store.getResolved().placements.get("c")?.container).toBe("box")

      const result = store.actions.lockIn()
      expect(result).toMatchObject({
        success: true,
        overlay: { ops: [width("total", 320)] },
        keptInSession: [move],
      })
      expect(saved.map(({ ops }) => ops)).toEqual([[width("total", 320)]])
      const resolved = store.getResolved()
      expect(resolved.placements.get("c")?.container).toBe("box")
      expect(resolved.unapplied).toEqual([])
      expect(widthOf(resolved, "total")).toBe(320)
    })

    it("has nothing to lock in without a preview", () => {
      const { store } = setup()

      expect(store.actions.lockIn()).toEqual({
        success: false,
        error: "There is no preview to lock in",
      })
    })
  })

  describe("status", () => {
    function asyncSetup() {
      const load = vi.fn<StorageAdapter["load"]>()
      const store = createLayerStore({
        surface,
        storage: { ...memoryStorage().storage, load },
      })
      return { store, load }
    }

    it("rejects changes until the layers have loaded", async () => {
      const { store, load } = asyncSetup()
      load.mockResolvedValue({
        personal: stored(
          personalOverlay("01KAB0000000000000000000P1", [width("total", 240)])
        ),
      })
      store.connect()

      expect(store.getStatus()).toEqual({ status: "loading" })
      expect(store.actions.applyOps("personal", [width("total", 200)])).toEqual(
        {
          success: false,
          error: "The layers of /orders haven't loaded yet",
        }
      )
      await vi.waitFor(() => {
        expect(store.getStatus()).toEqual({ status: "ready" })
      })
      expect(widthOf(store.getResolved(), "total")).toBe(240)
      expect(
        store.actions.applyOps("personal", [width("total", 200)]).success
      ).toBe(true)
    })

    it("reports a failed load, and loads again on reload", async () => {
      const { store, load } = asyncSetup()
      load.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({
        personal: stored(
          personalOverlay("01KAB0000000000000000000P1", [width("total", 240)])
        ),
      })
      store.connect()
      await vi.waitFor(() => {
        expect(store.getStatus()).toEqual({
          status: "error",
          error: new Error("offline"),
        })
      })
      expect(
        store.actions.applyOps("session", [width("total", 1)]).success
      ).toBe(false)

      store.actions.reload()
      expect(store.getStatus()).toEqual({ status: "loading" })
      await vi.waitFor(() => {
        expect(store.getStatus()).toEqual({ status: "ready" })
      })
      expect(widthOf(store.getResolved(), "total")).toBe(240)
    })

    it.each([
      ["rejects", "first"],
      ["resolves", "first"],
      ["rejects", "last"],
    ] as const)(
      "ignores a stale load that %s, settling %s",
      async (outcome, order) => {
        const { store, load } = asyncSetup()
        let settleStale: () => void = () => undefined
        load.mockReturnValueOnce(
          new Promise((resolve, reject) => {
            settleStale = () => {
              if (outcome === "rejects") {
                reject(new Error("stale"))
              } else {
                resolve({})
              }
            }
          })
        )
        let settleCurrent: () => void = () => undefined
        load.mockReturnValueOnce(
          new Promise((resolve) => {
            settleCurrent = () => {
              resolve({
                personal: stored(
                  personalOverlay("01KAB0000000000000000000P1", [
                    width("total", 240),
                  ])
                ),
              })
            }
          })
        )
        store.connect()
        store.actions.reload()
        if (order === "first") {
          settleStale()
          await Promise.resolve()
          settleCurrent()
        } else {
          settleCurrent()
          await vi.waitFor(() => {
            expect(store.getStatus()).toEqual({ status: "ready" })
          })
          settleStale()
        }
        await Promise.resolve()
        await Promise.resolve()

        expect(store.getStatus()).toEqual({ status: "ready" })
        expect(widthOf(store.getResolved(), "total")).toBe(240)
      }
    )

    it("reports a load that throws", () => {
      const store = createLayerStore({
        surface,
        storage: {
          ...memoryStorage().storage,
          load: () => {
            throw new Error("blocked")
          },
        },
      })
      store.connect()

      expect(store.getStatus()).toEqual({
        status: "error",
        error: new Error("blocked"),
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
        storage: memoryStorage().storage,
      })

      expect(store.getResolved()).toBe(store.getServerResolved())
    })
  })
})
