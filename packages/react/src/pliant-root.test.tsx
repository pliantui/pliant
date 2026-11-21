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
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from "vitest"

import {
  opSchema,
  type Op,
  type Overlay,
  type StoredOverlay,
} from "@pliantui/contract"
import type { ResolvedLayers } from "@pliantui/core"

import { memoryStorage, recordOf, stored } from "../test/storage"
import { localAdapter } from "./local-adapter"
import { PliantRoot, type PliantRootProps } from "./pliant-root"
import type { StorageAdapter, StoredLayers } from "./storage-adapter"
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

function personalOverlay(id: string, value: number) {
  return {
    v: 1,
    id,
    surface,
    layer: "personal",
    ops: [width(value)],
    basis: { contract: 1, core: "0.0.0", manifests: {} },
    source: "manual",
    createdBy: "local",
    createdAt: "2026-11-19T00:00:00.000Z",
  }
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
      `pliant:${surface}:01KAB0000000000000000000P1`,
      JSON.stringify(
        recordOf({
          v: 1,
          id: "01KAB0000000000000000000P1",
          surface,
          layer: "personal",
          ops: [width(240)],
          basis: { contract: 1, core: "0.0.0", manifests: {} },
          source: "manual",
          createdBy: "local",
          createdAt: "2026-11-19T00:00:00.000Z",
        })
      )
    )
    render(
      <PliantRoot surface={surface} storage={localAdapter}>
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

  it("calls a storage function when the surface mounts, not on rerenders", () => {
    const { storage } = memoryAdapter([
      personalOverlay("01KAB0000000000000000000P1", 240),
    ])
    const createStorage = vi.fn(() => storage)
    const { rerender } = render(
      <PliantRoot surface={surface} storage={createStorage}>
        <Width />
      </PliantRoot>
    )
    const calls = createStorage.mock.calls.length
    rerender(
      <PliantRoot surface={surface} storage={createStorage}>
        <Width />
      </PliantRoot>
    )

    expect(screen.getByRole("status").textContent).toBe("240")
    expect(createStorage).toHaveBeenCalled()
    expect(createStorage.mock.calls.length).toBe(calls)
  })

  it("names the fix when storage is missing", () => {
    expect(() =>
      renderToString(
        // @ts-expect-error JavaScript callers can leave storage out
        <PliantRoot surface={surface}>
          <Width />
        </PliantRoot>
      )
    ).toThrow("PliantRoot needs `storage`")
  })

  it("renders and hydrates the layers loaded on the server", async () => {
    const loaded = personalOverlay("01KAB0000000000000000000P1", 240)
    const memory = memoryAdapter([loaded]).storage
    const storage: StorageAdapter = {
      ...memory,
      load: (surface) => Promise.resolve(memory.load(surface)),
    }
    const rendered: string[] = []
    function Probe() {
      const status = usePliantStatus().status
      const shown = `${status}:${String(widthOf(useResolved()) ?? "base")}`
      rendered.push(shown)
      return <output>{shown}</output>
    }
    const app = (
      <PliantRoot
        surface={surface}
        storage={storage}
        layers={{ personal: stored(loaded) }}
      >
        <Probe />
      </PliantRoot>
    )
    const container = document.createElement("div")
    container.innerHTML = renderToString(app)
    document.body.append(container)
    expect(container.textContent).toBe("ready:240")
    const recoverableErrors = vi.fn()

    const root = await act(() =>
      hydrateRoot(container, app, { onRecoverableError: recoverableErrors })
    )
    onTestFinished(() => {
      act(() => {
        root.unmount()
      })
      container.remove()
    })

    expect(new Set(rendered)).toEqual(new Set(["ready:240"]))
    expect(recoverableErrors).not.toHaveBeenCalled()
  })

  it("loads storage again after mounting with server layers", async () => {
    const { storage } = memoryAdapter([
      personalOverlay("01KAB0000000000000000000P2", 300),
    ])

    render(
      <PliantRoot
        surface={surface}
        storage={storage}
        layers={{
          personal: stored(personalOverlay("01KAB0000000000000000000P1", 240)),
        }}
      >
        <Width />
      </PliantRoot>
    )

    await act(() => Promise.resolve())
    expect(screen.getByRole("status").textContent).toBe("300")
  })

  it("renders the base when storage holds corrupt data", () => {
    localStorage.setItem(`pliant:${surface}`, "{not json")
    sessionStorage.setItem(`pliant:session:${surface}`, "[1, 2")
    render(
      <PliantRoot surface={surface} storage={localAdapter}>
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
        <PliantRoot surface={surface} storage={localAdapter} onError={onError}>
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
    expect(localAdapter().load(surface)).toMatchObject({
      personal: [{ overlay: { ops: [width(200)] } }],
    })
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
            <PliantRoot surface={surface} storage={localAdapter} {...props}>
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
    async function storageEventFromAnotherTab() {
      await changedElsewhere(() => {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: `pliant:${surface}:01KAB0000000000000000000P1`,
            storageArea: localStorage,
          })
        )
      })
    }

    // Runs `report`, then lets the root load what changed.
    async function changedElsewhere(report: () => void) {
      await act(async () => {
        report()
        await Promise.resolve()
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
      await storageEventFromAnotherTab()
      expect(root.statuses.at(-1)).toBe("ready")

      await vi.waitFor(() => {
        expect(root.widths().total).toBe(300)
      })
      const afterReady = root.statuses.slice(root.statuses.indexOf("ready"))
      expect(afterReady).not.toContain("loading")
      expect(afterReady).not.toContain("error")
    })

    it("doesn't load again once unmounted", async () => {
      const adapter = localAdapter()
      const load = vi.fn((name: string) => adapter.load(name))
      const { unmount } = render(
        <PliantRoot surface={surface} storage={{ ...adapter, load }}>
          <Width />
        </PliantRoot>
      )
      const loads = load.mock.calls.length
      unmount()
      await storageEventFromAnotherTab()

      expect(load).toHaveBeenCalledTimes(loads)
    })

    it("drops what another tab removed and keeps changes not saved yet", async () => {
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
        void tab.adapter.remove?.(surface, record.overlay.id, {
          ifMatch: record.etag,
        })
      }
      await storageEventFromAnotherTab()
      expect(root.widths()).toEqual({ total: 260, status: "base" })

      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(tab.records().map((record) => record.overlay.ops)).toEqual([
        [columnWidth("total", 260)],
      ])
    })

    it("reports a failed load after a change elsewhere and keeps the layers", async () => {
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
      await storageEventFromAnotherTab()

      expect(onError).toHaveBeenCalledWith(new Error("offline"))
      expect(root.statuses.at(-1)).toBe("ready")
      expect(root.widths().total).toBe(300)
    })

    // A save as a synchronous adapter answers it, or as an async one.
    type Answer = (
      save: () => StoredOverlay | Promise<StoredOverlay>
    ) => StoredOverlay | Promise<StoredOverlay>
    const answerModes: readonly (readonly [string, Answer])[] = [
      ["synchronous", (save) => save()],
      [
        "asynchronous",
        (save) =>
          new Promise((resolve) => {
            resolve(save())
          }),
      ],
    ]

    async function pageHidden() {
      window.dispatchEvent(new Event("pagehide"))
      await act(() => new Promise((resolve) => setTimeout(resolve)))
    }

    // A server that stores the version but whose answer never arrives, and
    // that drops the milliseconds of `createdAt` as a database might.
    function lostAnswerOnce(conflictError?: (current: StoredOverlay) => Error) {
      const { storage, records } = memoryStorage()
      let lost = false
      const save: StorageAdapter["save"] = (name, overlay, options) => {
        const current = records.get(overlay.id)
        if (current && conflictError) {
          throw conflictError(current)
        }
        if (lost) {
          return storage.save(name, overlay, options)
        }
        lost = true
        void storage.save(
          name,
          { ...overlay, createdAt: overlay.createdAt.replace(/\.\d+Z$/, "Z") },
          options
        )
        throw new Error("The connection closed")
      }
      return { storage: { ...storage, save }, records }
    }

    it.each(answerModes)(
      "counts a version as saved when its id is stored already (%s)",
      async (_mode, answer) => {
        const onError = vi.fn()
        const lost = lostAnswerOnce()
        const save = vi.fn<StorageAdapter["save"]>((...args) =>
          answer(() => lost.storage.save(...args))
        )
        const root = renderRoot({
          storage: { ...lost.storage, save },
          onError,
        })

        act(() => {
          root.store().applyOps("personal", [columnWidth("total", 260)])
        })
        await pageHidden()
        expect(onError).toHaveBeenCalledWith(new Error("The connection closed"))
        act(() => {
          root.store().applyOps("personal", [columnWidth("status", 50)])
        })
        await pageHidden()
        await pageHidden()

        expect(save).toHaveBeenCalledTimes(3)
        expect(
          [...lost.records.values()].map(({ overlay }) => overlay.ops)
        ).toEqual([[columnWidth("total", 260)], [columnWidth("status", 50)]])
        expect(root.widths()).toEqual({ total: 260, status: 50 })
        expect(onError).toHaveBeenCalledTimes(1)
      }
    )

    it("recognizes a conflict error from another copy of Pliant", async () => {
      class CopiedConflictError extends Error {
        override readonly name = "StorageConflictError"
        readonly current: StoredOverlay
        constructor(current: StoredOverlay) {
          super("Conflict")
          this.current = current
        }
      }
      const onError = vi.fn()
      const lost = lostAnswerOnce((current) => new CopiedConflictError(current))
      const save = vi.fn(lost.storage.save)
      const root = renderRoot({ storage: { ...lost.storage, save }, onError })

      act(() => {
        root.store().applyOps("personal", [columnWidth("total", 260)])
      })
      await pageHidden()
      await pageHidden()
      await pageHidden()

      expect(save).toHaveBeenCalledTimes(2)
      expect(onError).toHaveBeenCalledTimes(1)
    })

    it("reports a conflict over another id and saves the version again later", async () => {
      const onError = vi.fn()
      const { storage, records } = memoryStorage()
      let conflicts = 2
      const save = vi.fn<StorageAdapter["save"]>((name, overlay, options) => {
        if (conflicts-- > 0) {
          throw new StorageConflictError(undefined)
        }
        return storage.save(name, overlay, options)
      })
      const root = renderRoot({ storage: { ...storage, save }, onError })

      act(() => {
        root.store().applyOps("personal", [columnWidth("total", 260)])
      })
      await pageHidden()
      await pageHidden()
      await pageHidden()

      expect(save).toHaveBeenCalledTimes(3)
      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith(expect.any(StorageConflictError))
      expect(records.size).toBe(1)
    })

    it("dates later changes after the stored overlay it kept", async () => {
      const { storage, records } = memoryStorage()
      let calls = 0
      const save: StorageAdapter["save"] = (name, overlay, options) => {
        calls++
        if (calls === 1) {
          // Stored by an earlier attempt, from a clock that runs ahead.
          const current = recordOf({
            ...overlay,
            createdAt: "2030-01-01T00:00:00.000Z",
          })
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
      act(() => {
        root.store().applyOps("personal", [columnWidth("total", 280)])
      })

      expect(root.widths().total).toBe(280)
    })

    it("stops saving a version once a load shows it stored", async () => {
      const lost = lostAnswerOnce()
      let notify = (): void => undefined
      const save = vi.fn(lost.storage.save)
      const root = renderRoot({
        storage: {
          ...lost.storage,
          save,
          subscribe: (_name, onChange) => {
            notify = onChange
            return () => undefined
          },
        },
        onError: vi.fn(),
      })

      act(() => {
        root.store().applyOps("personal", [columnWidth("total", 260)])
      })
      await pageHidden()
      await changedElsewhere(notify)
      // Another device removes it.
      lost.records.clear()
      await changedElsewhere(notify)
      await pageHidden()

      expect(save).toHaveBeenCalledTimes(1)
      expect(lost.records.size).toBe(0)
      expect(root.widths().total).toBe("base")
    })

    it("doesn't save a version again when its answer fails after a load showed it stored", async () => {
      const { storage, records } = memoryStorage()
      let notify = (): void => undefined
      let loseAnswer = (): void => undefined
      let saves = 0
      const save = vi.fn<StorageAdapter["save"]>((name, overlay, options) => {
        const record = storage.save(name, overlay, options)
        saves++
        return saves === 1
          ? new Promise((_resolve, reject) => {
              loseAnswer = () => {
                reject(new Error("The connection closed"))
              }
            })
          : record
      })
      const root = renderRoot({
        storage: {
          ...storage,
          load: (name) => Promise.resolve(storage.load(name)),
          save,
          subscribe: (_name, onChange) => {
            notify = onChange
            return () => undefined
          },
        },
        onError: vi.fn(),
      })
      await vi.waitFor(() => {
        expect(root.statuses.at(-1)).toBe("ready")
      })

      act(() => {
        root.store().applyOps("personal", [columnWidth("total", 260)])
      })
      await pageHidden()
      await changedElsewhere(notify)
      await pageHidden()
      await act(async () => {
        loseAnswer()
        await new Promise((resolve) => setTimeout(resolve))
      })
      // Another device removes it.
      records.clear()
      await changedElsewhere(notify)
      await pageHidden()
      act(() => {
        root.store().applyOps("personal", [columnWidth("status", 50)])
      })
      await pageHidden()

      expect([...records.values()].map(({ overlay }) => overlay.ops)).toEqual([
        [columnWidth("status", 50)],
      ])
      expect(root.widths()).toEqual({ total: "base", status: 50 })
    })

    it("drops a version removed after a load that ran while it saved", async () => {
      const { storage, records } = memoryStorage()
      let notify = (): void => undefined
      let gate: Promise<void> | undefined
      let openGate = (): void => undefined
      const root = renderRoot({
        storage: {
          ...storage,
          // Each load reads the store when it starts.
          load: async (name) => {
            const layers = storage.load(name)
            await gate
            return layers
          },
          save: (name, overlay, options) =>
            Promise.resolve(storage.save(name, overlay, options)),
          subscribe: (_name, onChange) => {
            notify = onChange
            return () => undefined
          },
        },
      })
      await vi.waitFor(() => {
        expect(root.statuses.at(-1)).toBe("ready")
      })

      act(() => {
        root.store().applyOps("personal", [columnWidth("total", 260)])
      })
      gate = new Promise((resolve) => {
        openGate = resolve
      })
      await changedElsewhere(notify)
      await pageHidden()
      gate = undefined
      await act(async () => {
        openGate()
        await new Promise((resolve) => setTimeout(resolve))
      })
      expect(root.widths().total).toBe(260)
      // Another device removes it, so the next load matches the one before.
      records.clear()
      await act(async () => {
        notify()
        await new Promise((resolve) => setTimeout(resolve))
      })

      expect(root.widths().total).toBe("base")
    })

    it("drops a version removed elsewhere before a failed save is retried", async () => {
      const { storage, records } = memoryStorage()
      const onError = vi.fn()
      let notify = (): void => undefined
      let loseAnswer = (): void => undefined
      let saves = 0
      const save = vi.fn<StorageAdapter["save"]>((name, overlay, options) => {
        const record = storage.save(name, overlay, options)
        saves++
        return saves === 1
          ? new Promise((_resolve, reject) => {
              loseAnswer = () => {
                reject(new Error("The connection closed"))
              }
            })
          : record
      })
      const root = renderRoot({
        storage: {
          ...storage,
          load: (name) => Promise.resolve(storage.load(name)),
          save,
          subscribe: (_name, onChange) => {
            notify = onChange
            return () => undefined
          },
        },
        onError,
      })
      await vi.waitFor(() => {
        expect(root.statuses.at(-1)).toBe("ready")
      })

      act(() => {
        root.store().applyOps("personal", [columnWidth("total", 260)])
      })
      await pageHidden()
      // Another device removes it before this tab hears the save's answer.
      const [record] = records.values()
      await storage.remove?.(surface, record?.overlay.id ?? "", {
        ifMatch: record?.etag ?? "",
      })
      await changedElsewhere(notify)
      await act(async () => {
        loseAnswer()
        await new Promise((resolve) => setTimeout(resolve))
      })
      await pageHidden()
      await pageHidden()

      expect(save).toHaveBeenCalledTimes(2)
      expect(
        [...records.values()].map(({ version, deletedAt }) => ({
          version,
          removed: deletedAt !== undefined,
        }))
      ).toEqual([{ version: 2, removed: true }])
      expect(root.widths().total).toBe("base")
      expect(onError).toHaveBeenCalledTimes(1)
    })

    it("never applies a tombstone the adapter loads", () => {
      const record = recordOf(
        personal(
          "01KAB0000000000000000000P1",
          [columnWidth("total", 260)],
          "2026-11-19T00:00:00.000Z"
        )
      )
      const root = renderRoot({
        storage: {
          load: () => ({
            personal: [{ ...record, deletedAt: record.updatedAt }],
          }),
          save: (_name, overlay) => recordOf(overlay),
        },
      })

      expect(root.statuses.at(-1)).toBe("ready")
      expect(root.widths().total).toBe("base")
    })

    it.each([
      ["succeeds", (record: StoredOverlay) => Promise.resolve(record)],
      [
        "is a conflict over its own id",
        (record: StoredOverlay) =>
          Promise.reject(new StorageConflictError(record)),
      ],
    ])(
      "drops a version removed elsewhere before its answer, which %s, arrived",
      async (_answer, answerWith) => {
        const { storage, records } = memoryStorage()
        let notify = (): void => undefined
        let answer = (): void => undefined
        const root = renderRoot({
          storage: {
            ...storage,
            load: (name) => Promise.resolve(storage.load(name)),
            save: (name, overlay, options) => {
              const record = storage.save(name, overlay, options)
              return new Promise((resolve) => {
                answer = () => {
                  resolve(Promise.resolve(record).then(answerWith))
                }
              })
            },
            subscribe: (_name, onChange) => {
              notify = onChange
              return () => undefined
            },
          },
          onError: vi.fn(),
        })
        await vi.waitFor(() => {
          expect(root.statuses.at(-1)).toBe("ready")
        })

        act(() => {
          root.store().applyOps("personal", [columnWidth("total", 260)])
        })
        await pageHidden()
        // Another device removes it, and this tab loads before the answer.
        records.clear()
        await act(async () => {
          notify()
          await new Promise((resolve) => setTimeout(resolve))
        })
        expect(root.widths().total).toBe(260)
        await act(async () => {
          answer()
          await new Promise((resolve) => setTimeout(resolve))
        })
        await pageHidden()

        expect(root.widths().total).toBe("base")
        expect(records.size).toBe(0)
      }
    )

    it("keeps a version saved while a load that started before it ran", async () => {
      const { storage } = memoryStorage()
      let notify = (): void => undefined
      let gate: Promise<void> | undefined
      let openGate = (): void => undefined
      const root = renderRoot({
        storage: {
          ...storage,
          // Each load reads the store when it starts.
          load: async (name) => {
            const layers = storage.load(name)
            await gate
            return layers
          },
          save: (name, overlay, options) =>
            Promise.resolve(storage.save(name, overlay, options)),
          subscribe: (_name, onChange) => {
            notify = onChange
            return () => undefined
          },
        },
      })
      await vi.waitFor(() => {
        expect(root.statuses.at(-1)).toBe("ready")
      })

      // Another device saves, and this tab starts loading.
      void storage.save(
        surface,
        personal(
          "01KAB0000000000000000000P1",
          [columnWidth("status", 90)],
          "2026-11-19T00:00:00.000Z"
        ),
        { ifMatch: null }
      )
      gate = new Promise((resolve) => {
        openGate = resolve
      })
      await changedElsewhere(notify)
      gate = undefined
      act(() => {
        root.store().applyOps("personal", [columnWidth("total", 260)])
      })
      await pageHidden()
      await act(async () => {
        openGate()
        await new Promise((resolve) => setTimeout(resolve))
      })

      expect(root.widths()).toEqual({ total: 260, status: 90 })
    })

    it("loads once for a burst of changes", async () => {
      const adapter = localAdapter()
      const load = vi.fn<StorageAdapter["load"]>((name) => adapter.load(name))
      renderRoot({ storage: { ...adapter, load } })
      const loads = load.mock.calls.length

      await changedElsewhere(() => {
        for (let index = 0; index < 50; index++) {
          window.dispatchEvent(
            new StorageEvent("storage", {
              key: `pliant:${surface}:01KAB0000000000000000000P1`,
              storageArea: localStorage,
            })
          )
        }
      })

      expect(load).toHaveBeenCalledTimes(loads + 1)
    })

    it("keeps two roots on one surface in step", async () => {
      vi.useFakeTimers()
      const first = renderRoot()
      const second = renderRoot()

      act(() => {
        first.store().applyOps("personal", [columnWidth("total", 260)])
      })
      await act(async () => {
        vi.advanceTimersByTime(1000)
        await Promise.resolve()
      })

      expect(second.widths().total).toBe(260)
    })

    it("loads once more for changes reported while it loads", async () => {
      const adapter = localAdapter()
      let notify = (): void => undefined
      const finishes: (() => void)[] = []
      const load = vi.fn<StorageAdapter["load"]>((name) => {
        const layers = adapter.load(name)
        return new Promise<StoredLayers>((resolve) => {
          finishes.push(() => {
            resolve(layers)
          })
        })
      })
      const root = renderRoot({
        storage: {
          ...adapter,
          load,
          subscribe: (_name, onChange) => {
            notify = onChange
            return () => undefined
          },
        },
      })
      const finishLoad = async () => {
        await act(async () => {
          for (const finish of finishes.splice(0)) {
            finish()
          }
          await Promise.resolve()
        })
      }
      await finishLoad()
      const loads = load.mock.calls.length

      await changedElsewhere(notify)
      expect(load).toHaveBeenCalledTimes(loads + 1)
      void adapter.save(
        surface,
        personal(
          "01KAB0000000000000000000P1",
          [columnWidth("total", 300)],
          "2026-11-19T00:00:00.000Z"
        ),
        { ifMatch: null }
      )
      await changedElsewhere(notify)
      await changedElsewhere(notify)
      expect(load).toHaveBeenCalledTimes(loads + 1)
      await finishLoad()
      expect(load).toHaveBeenCalledTimes(loads + 2)
      await finishLoad()

      expect(load).toHaveBeenCalledTimes(loads + 2)
      expect(root.widths().total).toBe(300)
    })

    it("keeps the resolved layers when nothing stored changed", async () => {
      const { result } = renderHook(() => useResolved(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <PliantRoot surface={surface} storage={localAdapter}>
            {children}
          </PliantRoot>
        ),
      })
      void localAdapter().save(
        surface,
        personal(
          "01KAB0000000000000000000P1",
          [columnWidth("total", 300)],
          "2026-11-19T00:00:00.000Z"
        ),
        { ifMatch: null }
      )
      await storageEventFromAnotherTab()
      const before = result.current
      await storageEventFromAnotherTab()

      expect(columnOf(before, "total")).toBe(300)
      expect(result.current).toBe(before)
    })

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
      await storageEventFromAnotherTab()
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
