import {
  Activity,
  Profiler,
  useEffect,
  useLayoutEffect,
  type ReactNode,
} from "react"
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
} from "@testing-library/react"
import { createRoot, hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { opSchema, type Op, type Overlay } from "@pliantui/contract"
import type { ResolvedLayers } from "@pliantui/core"

import { memoryStorage, recordOf, stored } from "../test/storage"
import { localAdapter } from "./local-adapter"
import { PliantRoot, type PliantRootProps } from "./pliant-root"
import type { StorageAdapter } from "./storage-adapter"
import { StorageConflictError } from "./storage-conflict-error"
import { useMountedNodes } from "./use-mounted-nodes"
import { usePliantStatus } from "./use-pliant-status"
import { usePliantStore } from "./use-pliant-store"
import { usePliantSurface } from "./use-pliant-surface"
import { usePreview } from "./use-preview"
import { useResolved } from "./use-resolved"

const surface = "/orders"

const width = (value: number): Op => ({
  op: "setColumnWidth",
  target: "orders-table/columns/total",
  width: value,
})

function widthOf({ properties }: ResolvedLayers) {
  const op = properties.get("orders-table/columns/total")?.get("width")?.winner
    .check.op
  return op?.op === "setColumnWidth" ? op.width : undefined
}

function memoryAdapter(personal: unknown[] = []) {
  return memoryStorage({ personal })
}

function Width() {
  return <output>{widthOf(useResolved()) ?? "base"}</output>
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("PliantRoot", () => {
  it("resolves the personal layer saved in localStorage by default", () => {
    localStorage.setItem(
      `pliant:${surface}`,
      JSON.stringify({
        v: 1,
        personal: stored({
          v: 1,
          id: "01KAB0000000000000000000P1",
          surface,
          layer: "personal",
          ops: [width(240)],
          basis: { contract: 1, core: "0.0.0", manifests: {} },
          source: "manual",
          createdBy: "local",
          createdAt: "2026-11-19T00:00:00.000Z",
        }),
      })
    )
    render(
      <PliantRoot surface={surface}>
        <Width />
      </PliantRoot>
    )

    expect(screen.getByRole("status").textContent).toBe("240")
  })

  it("hydrates the server render, then applies the stored layers", async () => {
    const { storage } = memoryAdapter([
      {
        v: 1,
        id: "01KAB0000000000000000000P1",
        surface,
        layer: "personal",
        ops: [width(240)],
        basis: { contract: 1, core: "0.0.0", manifests: {} },
        source: "manual",
        createdBy: "local",
        createdAt: "2026-11-19T00:00:00.000Z",
      },
    ])
    const app = (
      <PliantRoot surface={surface} storage={storage}>
        <Width />
      </PliantRoot>
    )
    const container = document.createElement("div")
    container.innerHTML = renderToString(app)
    document.body.append(container)
    expect(container.textContent).toBe("base")
    const recoverableErrors = vi.fn()

    const root = await act(() =>
      hydrateRoot(container, app, { onRecoverableError: recoverableErrors })
    )
    expect(container.textContent).toBe("240")
    expect(recoverableErrors).not.toHaveBeenCalled()
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it("renders the base when storage holds corrupt data", () => {
    localStorage.setItem(`pliant:${surface}`, "{not json")
    sessionStorage.setItem(`pliant:session:${surface}`, "[1, 2")
    render(
      <PliantRoot surface={surface}>
        <Width />
      </PliantRoot>
    )

    expect(screen.getByRole("status").textContent).toBe("base")
  })

  it("applies ops and saves personal changes to the storage adapter", () => {
    vi.useFakeTimers()
    const { storage, saved } = memoryAdapter()
    const { result } = renderHook(
      () => ({ resolved: useResolved(), store: usePliantStore() }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <PliantRoot surface={surface} storage={storage}>
            {children}
          </PliantRoot>
        ),
      }
    )

    act(() => {
      result.current.store.applyOps("personal", [width(200)])
    })
    act(() => {
      result.current.store.applyOps("personal", [width(260)])
    })
    expect(widthOf(result.current.resolved)).toBe(260)
    expect(saved).toEqual([])

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(saved.map(({ ops }) => ops)).toEqual([[width(260)]])
  })

  it("records its lang prop in the overlays it makes", () => {
    const { storage } = memoryAdapter()
    let lang = "fr-CA"
    const { result, rerender } = renderHook(() => usePliantStore(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <PliantRoot surface={surface} storage={storage} lang={lang}>
          {children}
        </PliantRoot>
      ),
    })
    const first = result.current.applyOps("session", [width(200)])
    lang = "de"
    rerender()
    const second = result.current.applyOps("session", [width(220)])

    expect(first.success && first.overlay.lang).toBe("fr-CA")
    expect(second.success && second.overlay.lang).toBe("de")
  })

  it("flushes pending personal changes when the page is hidden", () => {
    const { storage, saved } = memoryAdapter()
    const { result } = renderHook(() => usePliantStore(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <PliantRoot surface={surface} storage={storage}>
          {children}
        </PliantRoot>
      ),
    })

    act(() => {
      result.current.applyOps("personal", [width(200)])
    })
    window.dispatchEvent(new Event("pagehide"))
    expect(saved.map(({ ops }) => ops)).toEqual([[width(200)]])
  })

  it("previews, locks in and discards", () => {
    const { storage, saved } = memoryAdapter()
    const { result } = renderHook(
      () => ({
        resolved: useResolved(),
        preview: usePreview(),
        store: usePliantStore(),
      }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <PliantRoot surface={surface} storage={storage}>
            {children}
          </PliantRoot>
        ),
      }
    )
    const answer = (id: string, value: number) => ({
      v: 1,
      id,
      surface,
      layer: "session",
      ops: [width(value)],
      basis: { contract: 1, core: "0.0.0", manifests: {} },
      source: "ai",
      createdBy: "user-1",
      createdAt: "2026-11-19T00:00:00.000Z",
    })

    act(() => {
      result.current.store.preview(answer("01KAB0000000000000000000S1", 300))
    })
    expect(result.current.preview?.id).toBe("01KAB0000000000000000000S1")
    expect(widthOf(result.current.resolved)).toBe(300)

    act(() => {
      result.current.store.discard()
    })
    expect(result.current.preview).toBeNull()
    expect(widthOf(result.current.resolved)).toBeUndefined()

    act(() => {
      result.current.store.preview(answer("01KAB0000000000000000000S2", 320))
    })
    act(() => {
      result.current.store.lockIn()
    })
    expect(result.current.preview).toBeNull()
    expect(widthOf(result.current.resolved)).toBe(320)
    expect(saved).toMatchObject([{ layer: "personal", ops: [width(320)] }])
  })

  it("keeps the session layer and preview across a remount", () => {
    const { storage } = memoryAdapter()
    function Apply() {
      const store = usePliantStore()
      return (
        <button
          onClick={() => {
            store.applyOps("session", [width(180)])
          }}
        >
          Apply
        </button>
      )
    }
    const first = render(
      <PliantRoot surface={surface} storage={storage}>
        <Apply />
      </PliantRoot>
    )
    act(() => {
      screen.getByRole("button").click()
    })
    first.unmount()

    render(
      <PliantRoot surface={surface} storage={storage}>
        <Width />
      </PliantRoot>
    )
    expect(screen.getByRole("status").textContent).toBe("180")
  })

  it("applies dormant ops once their container mounts", async () => {
    const move = opSchema.parse({
      op: "move",
      target: "dashboard/slots/c",
      to: { into: "sidebar" },
    })
    const { storage } = memoryAdapter([
      {
        v: 1,
        id: "01KAB0000000000000000000P1",
        surface,
        layer: "personal",
        ops: [move],
        basis: { contract: 1, core: "0.0.0", manifests: {} },
        source: "manual",
        createdBy: "local",
        createdAt: "2026-11-19T00:00:00.000Z",
      },
    ])
    function Node({ id }: { id: string }) {
      useMountedNodes([id])
      return null
    }
    function Container() {
      const { placements } = useResolved()
      return <output>{placements.get("c")?.container ?? "dashboard"}</output>
    }
    function App({ sidebar }: { sidebar: boolean }) {
      return (
        <PliantRoot surface={surface} storage={storage}>
          <Node id="dashboard" />
          <Node id="c" />
          {sidebar && <Node id="sidebar" />}
          <Container />
        </PliantRoot>
      )
    }
    const { rerender } = render(<App sidebar={false} />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByRole("status").textContent).toBe("dashboard")

    rerender(<App sidebar />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByRole("status").textContent).toBe("sidebar")

    rerender(<App sidebar={false} />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByRole("status").textContent).toBe("dashboard")

    rerender(<App sidebar />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByRole("status").textContent).toBe("sidebar")
  })

  it("returns the same resolved layers until something changes", async () => {
    const { storage } = memoryAdapter()
    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => {
        useMountedNodes(ids)
        return { resolved: useResolved(), store: usePliantStore() }
      },
      {
        initialProps: { ids: ["a"] },
        wrapper: ({ children }: { children: ReactNode }) => (
          <PliantRoot surface={surface} storage={storage} teamOrder={["ops"]}>
            {children}
          </PliantRoot>
        ),
      }
    )
    await act(async () => {
      await Promise.resolve()
    })
    const first = result.current.resolved
    rerender({ ids: ["a"] })
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.resolved).toBe(first)

    act(() => {
      result.current.store.applyOps("session", [width(200)])
    })
    expect(result.current.resolved).not.toBe(first)
  })

  it("starts a new store when the surface changes", () => {
    const { storage } = memoryAdapter()
    const stores = new Set<unknown>()
    function Probe() {
      stores.add(usePliantStore())
      return null
    }
    const { rerender } = render(
      <PliantRoot surface={surface} storage={storage}>
        <Probe />
      </PliantRoot>
    )
    rerender(
      <PliantRoot surface="/invoices" storage={storage}>
        <Probe />
      </PliantRoot>
    )

    expect(stores.size).toBe(2)
  })

  it("gives the surface of the nearest root", () => {
    const { storage } = memoryAdapter()
    function Surface() {
      return <output>{usePliantSurface()}</output>
    }
    const { rerender } = render(
      <PliantRoot surface={surface} storage={storage}>
        <Surface />
      </PliantRoot>
    )
    expect(screen.getByRole("status").textContent).toBe(surface)

    rerender(
      <PliantRoot surface="/invoices" storage={storage}>
        <Surface />
      </PliantRoot>
    )
    expect(screen.getByRole("status").textContent).toBe("/invoices")
  })

  it("is ready with a synchronous adapter before the first paint", async () => {
    const actEnvironment: unknown = Reflect.get(
      globalThis,
      "IS_REACT_ACT_ENVIRONMENT"
    )
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", false)
    const commits: string[] = []
    function Status() {
      const { status } = usePliantStatus()
      useLayoutEffect(() => {
        commits.push(`layout:${status}`)
        if (status === "loading") {
          // The browser can't paint before the current task's microtasks.
          queueMicrotask(() => {
            commits.push("microtask")
          })
        }
      })
      useEffect(() => {
        commits.push(`passive:${status}`)
      })
      return <output>{status}</output>
    }
    const root = createRoot(document.createElement("div"))
    try {
      root.render(
        <PliantRoot surface={surface} storage={memoryAdapter().storage}>
          <Status />
        </PliantRoot>
      )
      await vi.waitFor(() => {
        expect(commits).toContain("passive:ready")
      })

      expect(commits.indexOf("layout:ready")).toBeLessThan(
        commits.indexOf("microtask")
      )
    } finally {
      root.unmount()
      Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", actEnvironment)
    }
  })

  it("applies what it loads when shown again, before the paint", async () => {
    const actEnvironment: unknown = Reflect.get(
      globalThis,
      "IS_REACT_ACT_ENVIRONMENT"
    )
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", false)
    let personal: unknown[] = []
    const storage: StorageAdapter = {
      ...memoryStorage().storage,
      load: () => ({ personal: stored(...personal) }),
    }
    const commits: string[] = []
    function Probe() {
      const value = String(widthOf(useResolved()) ?? "base")
      useLayoutEffect(() => {
        commits.push(`layout:${value}`)
        if (value === "base") {
          queueMicrotask(() => {
            commits.push("microtask")
          })
        }
      })
      return null
    }
    const app = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <PliantRoot surface={surface} storage={storage}>
          <Probe />
        </PliantRoot>
      </Activity>
    )
    const root = createRoot(document.createElement("div"))
    try {
      root.render(app("visible"))
      await vi.waitFor(() => {
        expect(commits).toContain("microtask")
      })
      root.render(app("hidden"))
      await new Promise((resolve) => setTimeout(resolve, 20))
      personal = [
        {
          v: 1,
          id: "01KAB0000000000000000000P1",
          surface,
          layer: "personal",
          ops: [width(240)],
          basis: { contract: 1, core: "0.0.0", manifests: {} },
          source: "manual",
          createdBy: "local",
          createdAt: "2026-11-19T00:00:00.000Z",
        },
      ]
      commits.length = 0
      root.render(app("visible"))
      await vi.waitFor(() => {
        expect(commits).toContain("layout:240")
      })

      expect(commits).toContain("microtask")
      expect(commits.indexOf("layout:240")).toBeLessThan(
        commits.indexOf("microtask")
      )
    } finally {
      root.unmount()
      Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", actEnvironment)
    }
  })

  it("re-renders a selector only when its result changes", () => {
    const commits = vi.fn()
    const selectWidth = (resolved: ResolvedLayers) => widthOf(resolved)
    const { result } = renderHook(
      () => ({
        width: useResolved(selectWidth),
        store: usePliantStore(),
      }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <PliantRoot surface={surface} storage={memoryAdapter().storage}>
            <Profiler id="hook" onRender={commits}>
              {children}
            </Profiler>
          </PliantRoot>
        ),
      }
    )
    const before = commits.mock.calls.length

    act(() => {
      result.current.store.applyOps("session", [
        { op: "hide", target: "orders-table/columns/notes" },
      ])
    })
    expect(commits).toHaveBeenCalledTimes(before)

    act(() => {
      result.current.store.applyOps("session", [width(200)])
    })
    expect(result.current.width).toBe(200)
    expect(commits).toHaveBeenCalledTimes(before + 1)
  })

  it("reports failed saves to onError and saves them again later", () => {
    const onError = vi.fn()
    const setItem = vi
      .spyOn(localStorage, "setItem")
      .mockImplementationOnce(() => {
        throw new DOMException("Storage is full", "QuotaExceededError")
      })
    const { result } = renderHook(() => usePliantStore(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <PliantRoot surface={surface} onError={onError}>
          {children}
        </PliantRoot>
      ),
    })

    act(() => {
      result.current.applyOps("personal", [width(200)])
    })
    window.dispatchEvent(new Event("pagehide"))
    expect(onError).toHaveBeenCalledWith(
      new DOMException("Storage is full", "QuotaExceededError")
    )

    setItem.mockRestore()
    window.dispatchEvent(new Event("pagehide"))
    expect(
      JSON.parse(localStorage.getItem(`pliant:${surface}`) ?? "null")
    ).toMatchObject({ personal: [{ overlay: { ops: [width(200)] } }] })
  })

  it("reports saving over newer data to onError", () => {
    const onError = vi.fn()
    localStorage.setItem(`pliant:${surface}`, JSON.stringify({ v: 2 }))
    const { result } = renderHook(() => usePliantStore(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <PliantRoot surface={surface} onError={onError}>
          {children}
        </PliantRoot>
      ),
    })

    act(() => {
      result.current.applyOps("personal", [width(200)])
    })
    window.dispatchEvent(new Event("pagehide"))
    expect(onError).toHaveBeenCalledWith(
      new Error(
        `The overlays saved for ${surface} were written by a newer version of Pliant`
      )
    )
    expect(localStorage.getItem(`pliant:${surface}`)).toBe('{"v":2}')
  })

  it("throws when a hook is used outside a PliantRoot", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)

    expect(() => renderHook(() => useResolved())).toThrow(
      "useResolved must be used within a PliantRoot"
    )
  })

  describe("changes stored elsewhere", () => {
    const columnWidth = (column: string, value: number): Op => ({
      op: "setColumnWidth",
      target: `orders-table/columns/${column}`,
      width: value,
    })

    function personal(id: string, ops: Op[], createdAt: string): Overlay {
      return {
        v: 1,
        id,
        surface,
        layer: "personal",
        ops,
        basis: { contract: 1, core: "0.0.0", manifests: {} },
        source: "manual",
        createdBy: "local",
        createdAt,
      }
    }

    function columnOf({ properties }: ResolvedLayers, column: string) {
      const op = properties.get(`orders-table/columns/${column}`)?.get("width")
        ?.winner.check.op
      return op?.op === "setColumnWidth" ? op.width : "base"
    }

    function renderRoot(props: Partial<PliantRootProps> = {}) {
      const statuses: string[] = []
      const { result } = renderHook(
        () => {
          const status = usePliantStatus().status
          statuses.push(status)
          return {
            status,
            resolved: useResolved(),
            store: usePliantStore(),
          }
        },
        {
          wrapper: ({ children }: { children: ReactNode }) => (
            <PliantRoot surface={surface} {...props}>
              {children}
            </PliantRoot>
          ),
        }
      )
      return {
        statuses,
        widths: () => ({
          total: columnOf(result.current.resolved, "total"),
          status: columnOf(result.current.resolved, "status"),
        }),
        store: () => result.current.store,
      }
    }

    // What the browser does in every other tab of the origin.
    function storageEventFromAnotherTab() {
      act(() => {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: `pliant:${surface}`,
            storageArea: localStorage,
          })
        )
      })
    }

    function otherTab() {
      const adapter = localAdapter()
      const records = () => {
        const layers = adapter.load(surface)
        return layers instanceof Promise ? [] : (layers.personal ?? [])
      }
      return { adapter, records }
    }

    it("shows what another tab saves, without loading again", async () => {
      const adapter = localAdapter()
      const root = renderRoot({
        storage: {
          ...adapter,
          load: (name) => Promise.resolve(adapter.load(name)),
        },
      })
      await vi.waitFor(() => {
        expect(root.statuses.at(-1)).toBe("ready")
      })
      expect(root.widths().total).toBe("base")

      void otherTab().adapter.save(
        surface,
        personal(
          "01KAB0000000000000000000P1",
          [columnWidth("total", 300)],
          "2026-11-19T00:00:00.000Z"
        ),
        { ifMatch: null }
      )
      expect(root.widths().total).toBe("base")
      storageEventFromAnotherTab()
      expect(root.statuses.at(-1)).toBe("ready")

      await vi.waitFor(() => {
        expect(root.widths().total).toBe(300)
      })
      expect(root.statuses.slice(root.statuses.indexOf("ready"))).toEqual(
        expect.not.arrayContaining(["loading", "error"])
      )
    })

    it("doesn't load again once unmounted", () => {
      const adapter = localAdapter()
      const load = vi.fn((name: string) => adapter.load(name))
      const { unmount } = render(
        <PliantRoot surface={surface} storage={{ ...adapter, load }}>
          <Width />
        </PliantRoot>
      )
      const loads = load.mock.calls.length
      unmount()
      storageEventFromAnotherTab()

      expect(load).toHaveBeenCalledTimes(loads)
    })

    it("drops what another tab removed and keeps changes not saved yet", () => {
      vi.useFakeTimers()
      const tab = otherTab()
      void tab.adapter.save(
        surface,
        personal(
          "01KAB0000000000000000000P1",
          [columnWidth("total", 300)],
          "2026-11-19T00:00:00.000Z"
        ),
        { ifMatch: null }
      )
      void tab.adapter.save(
        surface,
        personal(
          "01KAB0000000000000000000P2",
          [columnWidth("status", 90)],
          "2026-11-19T00:00:00.000Z"
        ),
        { ifMatch: null }
      )
      const root = renderRoot()
      expect(root.widths()).toEqual({ total: 300, status: 90 })

      act(() => {
        root.store().applyOps("personal", [columnWidth("total", 260)])
      })
      for (const record of tab.records()) {
        void tab.adapter.remove(surface, record.overlay.id, {
          ifMatch: record.etag,
        })
      }
      storageEventFromAnotherTab()
      expect(root.widths()).toEqual({ total: 260, status: "base" })

      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(tab.records().map((record) => record.overlay.ops)).toEqual([
        [columnWidth("total", 260)],
      ])
    })

    it("reports a failed load after a change elsewhere and keeps the layers", () => {
      const onError = vi.fn()
      const adapter = localAdapter()
      let failing = false
      const storage: StorageAdapter = {
        ...adapter,
        load: (name) => {
          if (failing) {
            throw new Error("offline")
          }
          return adapter.load(name)
        },
      }
      void adapter.save(
        surface,
        personal(
          "01KAB0000000000000000000P1",
          [columnWidth("total", 300)],
          "2026-11-19T00:00:00.000Z"
        ),
        { ifMatch: null }
      )
      const root = renderRoot({ storage, onError })
      failing = true
      storageEventFromAnotherTab()

      expect(onError).toHaveBeenCalledWith(new Error("offline"))
      expect(root.statuses.at(-1)).toBe("ready")
      expect(root.widths().total).toBe(300)
    })

    // A conflict as a synchronous adapter throws it, or as an async one
    // rejects with it.
    const conflictModes = [
      [
        "thrown",
        (error: StorageConflictError): never => {
          throw error
        },
      ],
      ["rejected", (error: StorageConflictError) => Promise.reject(error)],
    ] as const

    async function pageHidden() {
      window.dispatchEvent(new Event("pagehide"))
      await act(() => new Promise((resolve) => setTimeout(resolve)))
    }

    it.each(conflictModes)(
      "saves a version again under a new id when another one has its id (%s)",
      async (_mode, fail) => {
        const onError = vi.fn()
        const { storage, saved, records } = memoryStorage()
        const theirs = personal(
          "01KAB0000000000000000000P1",
          [columnWidth("total", 300), columnWidth("status", 90)],
          "2026-11-19T00:00:00.000Z"
        )
        const save = vi.fn<StorageAdapter["save"]>((name, overlay, options) => {
          if (save.mock.calls.length === 1) {
            const current = recordOf({ ...theirs, id: overlay.id })
            records.set(overlay.id, current)
            return fail(new StorageConflictError(current))
          }
          return storage.save(name, overlay, options)
        })
        const root = renderRoot({ storage: { ...storage, save }, onError })

        act(() => {
          root.store().applyOps("personal", [columnWidth("total", 260)])
        })
        await pageHidden()

        expect(save).toHaveBeenCalledTimes(2)
        const [first, second] = save.mock.calls.map(([, overlay]) => overlay)
        expect(second?.id).not.toBe(first?.id)
        expect({ ...second, id: first?.id }).toEqual(first)
        expect(saved).toEqual([second])
        expect(root.widths()).toEqual({ total: 260, status: 90 })
        expect(onError).not.toHaveBeenCalled()
      }
    )

    it("dates later changes after the stored overlay it kept", async () => {
      const { storage, records } = memoryStorage()
      let calls = 0
      const save: StorageAdapter["save"] = (name, overlay, options) => {
        calls++
        if (calls === 1) {
          // Saved from a device whose clock runs ahead.
          const current = recordOf(
            personal(
              overlay.id,
              [columnWidth("total", 300)],
              "2030-01-01T00:00:00.000Z"
            )
          )
          records.set(overlay.id, current)
          throw new StorageConflictError(current)
        }
        return storage.save(name, overlay, options)
      }
      const root = renderRoot({ storage: { ...storage, save } })

      act(() => {
        root.store().applyOps("personal", [columnWidth("total", 260)])
      })
      await pageHidden()
      expect(root.widths().total).toBe(300)
      act(() => {
        root.store().applyOps("personal", [columnWidth("total", 280)])
      })

      expect(root.widths().total).toBe(280)
    })

    it.each(conflictModes)(
      "treats a conflict with the same version as saved (%s)",
      async (_mode, fail) => {
        const onError = vi.fn()
        const { storage, records } = memoryStorage()
        const save = vi.fn<StorageAdapter["save"]>((name, overlay, options) => {
          if (save.mock.calls.length === 1) {
            // The first attempt stored it, but its answer was lost.
            void storage.save(name, overlay, options)
            return fail(new StorageConflictError(records.get(overlay.id)))
          }
          return storage.save(name, overlay, options)
        })
        const root = renderRoot({ storage: { ...storage, save }, onError })

        act(() => {
          root.store().applyOps("personal", [columnWidth("total", 260)])
        })
        await pageHidden()
        await pageHidden()

        expect(save).toHaveBeenCalledTimes(1)
        expect(records.size).toBe(1)
        expect(root.widths().total).toBe(260)
        expect(onError).not.toHaveBeenCalled()
      }
    )

    it.each(conflictModes)(
      "reports conflicts it can't resolve instead of saving again and again (%s)",
      async (_mode, fail) => {
        const onError = vi.fn()
        const { storage } = memoryStorage()
        const other = recordOf(
          personal(
            "01KAB0000000000000000000P9",
            [columnWidth("status", 90)],
            "2026-11-19T00:00:00.000Z"
          )
        )
        let calls = 0
        const save = vi.fn<StorageAdapter["save"]>((_name, overlay) => {
          calls++
          // Another overlay under its id, then nothing at all.
          return fail(
            new StorageConflictError(
              calls === 1
                ? recordOf({ ...other.overlay, id: overlay.id })
                : undefined
            )
          )
        })
        const root = renderRoot({ storage: { ...storage, save }, onError })

        act(() => {
          root.store().applyOps("personal", [columnWidth("total", 260)])
        })
        await pageHidden()
        act(() => {
          root.store().applyOps("personal", [columnWidth("status", 120)])
        })
        await pageHidden()

        expect(save).toHaveBeenCalledTimes(3)
        expect(onError).toHaveBeenCalledTimes(2)
        expect(onError).toHaveBeenCalledWith(expect.any(StorageConflictError))
      }
    )

    it("keeps a version saved while a load after a change elsewhere ran", async () => {
      const { storage } = memoryStorage()
      let loadStarted = (): void => undefined
      let finishSave = (): void => undefined
      const root = renderRoot({
        storage: {
          ...storage,
          // The load reads the store before the save below finishes.
          load: (name) => {
            const layers = storage.load(name)
            return new Promise((resolve) => {
              loadStarted = () => {
                resolve(layers)
              }
            })
          },
          save: (name, overlay, options) =>
            new Promise((resolve) => {
              finishSave = () => {
                resolve(storage.save(name, overlay, options))
              }
            }),
          subscribe: (_name, onChange) => {
            window.addEventListener("storage", onChange)
            return () => {
              window.removeEventListener("storage", onChange)
            }
          },
        },
      })
      loadStarted()
      await vi.waitFor(() => {
        expect(root.statuses.at(-1)).toBe("ready")
      })

      act(() => {
        root.store().applyOps("personal", [columnWidth("total", 260)])
      })
      window.dispatchEvent(new Event("pagehide"))
      storageEventFromAnotherTab()
      await act(async () => {
        finishSave()
        await Promise.resolve()
        loadStarted()
        await new Promise((resolve) => setTimeout(resolve))
      })

      expect(root.widths().total).toBe(260)
    })
  })
})
