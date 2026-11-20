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

import { PliantRoot } from "./pliant-root"
import type { StorageAdapter } from "./storage-adapter"
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
  const saved: Overlay[] = []
  const storage: StorageAdapter = {
    load: () => ({ personal }),
    save: (_surface, overlay) => {
      saved.push(overlay)
    },
  }
  return { storage, saved }
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
        personal: [
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
        ],
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
    const commits = vi.fn()
    function App({ sidebar }: { sidebar: boolean }) {
      return (
        <Profiler id="app" onRender={commits}>
          <PliantRoot surface={surface} storage={storage}>
            <Node id="dashboard" />
            <Node id="c" />
            {sidebar && <Node id="sidebar" />}
            <Container />
          </PliantRoot>
        </Profiler>
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

    const settledCommits = commits.mock.calls.length
    await act(async () => {
      await Promise.resolve()
    })
    expect(commits).toHaveBeenCalledTimes(settledCommits)
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

  it("saves a change once when the page is hidden", () => {
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
    expect(widthOf(result.current.resolved)).toBe(200)
    window.dispatchEvent(new Event("pagehide"))
    expect(saved).toHaveLength(1)
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
    let stored: unknown[] = []
    const storage: StorageAdapter = {
      load: () => ({ personal: stored }),
      save: () => undefined,
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
      stored = [
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
    ).toMatchObject({ personal: [{ ops: [width(200)] }] })
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
})
