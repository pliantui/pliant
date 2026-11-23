// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest"

import { createPliantAskChatStore, pliantAskChatsKey } from "./pliant-ask-chats"

class MemoryStorage implements Storage {
  items = new Map<string, string>()
  get length() {
    return this.items.size
  }
  clear() {
    this.items.clear()
  }
  getItem(key: string) {
    return this.items.get(key) ?? null
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.items.delete(key)
  }
  setItem(key: string, value: string) {
    this.items.set(key, value)
  }
}

let storage: MemoryStorage

function createStore(surface = "/orders") {
  return createPliantAskChatStore(pliantAskChatsKey(surface), () => storage)
}

beforeEach(() => {
  storage = new MemoryStorage()
})

describe("createPliantAskChatStore", () => {
  it("starts with no chats and a new chat open", () => {
    expect(createStore().getSnapshot()).toEqual({ active: null, chats: [] })
  })

  it("creates a chat, titled from its first ask, when a new chat gets one", () => {
    const store = createStore()

    const chatId = store.ask("  put the overdue   card first ", "Key metrics")
    store.ask("and hide orders", "Key metrics")

    const { active, chats } = store.getSnapshot()
    expect(active).toBe(chatId)
    expect(chats).toHaveLength(1)
    expect(chats[0]?.title).toBe("put the overdue card first")
    expect(chats[0]?.messages.map((message) => message.kind)).toEqual([
      "ask",
      "ask",
    ])
  })

  it("shortens a long title", () => {
    const store = createStore()

    store.ask("a".repeat(200), "Key metrics")

    const title = store.getSnapshot().chats[0]?.title ?? ""
    expect(title.length).toBeLessThanOrEqual(60)
    expect(title.endsWith("…")).toBe(true)
  })

  it("starts another chat after New chat and switches between them", () => {
    const store = createStore()
    const first = store.ask("put the overdue card first", "Key metrics")

    store.newChat()
    expect(store.getSnapshot().active).toBeNull()
    const second = store.ask("hide the orders card", "Key metrics")

    expect(store.getSnapshot().chats.map(({ title }) => title)).toEqual([
      "hide the orders card",
      "put the overdue card first",
    ])
    store.switchChat(first)
    expect(store.getSnapshot().active).toBe(first)
    store.switchChat("missing")
    expect(store.getSnapshot().active).toBe(first)
    expect(second).not.toBe(first)
  })

  it("adds answers to their own chat after a switch", () => {
    const store = createStore()
    const first = store.ask("put the overdue card first", "Key metrics")
    store.newChat()
    store.ask("hide the orders card", "Key metrics")

    store.answer(first, { kind: "clarify", text: "Which card?" })

    const chat = store.getSnapshot().chats.find(({ id }) => id === first)
    expect(chat?.messages.at(-1)).toMatchObject({
      kind: "clarify",
      text: "Which card?",
    })
  })

  it("records whether a change was locked in or discarded", () => {
    const store = createStore()
    const chatId = store.ask("put the overdue card first", "Key metrics")
    store.answer(chatId, {
      kind: "change",
      target: "Key metrics",
      overlay: "01KAB0000000000000000000S1",
      ops: ["move"],
      explain: ["Moved the Overdue card first."],
    })
    const change = store.getSnapshot().chats[0]?.messages.at(-1)

    store.settle(chatId, change?.id ?? "", {
      outcome: "locked",
      keptInSession: 1,
    })

    expect(store.getSnapshot().chats[0]?.messages.at(-1)).toMatchObject({
      kind: "change",
      outcome: "locked",
      keptInSession: 1,
    })
  })

  it("deletes a chat and opens a new one in its place", () => {
    const store = createStore()
    const chatId = store.ask("put the overdue card first", "Key metrics")

    store.deleteChat(chatId)

    expect(store.getSnapshot()).toEqual({ active: null, chats: [] })
  })

  it("keeps chats across page loads, for each surface on its own", () => {
    const store = createStore()
    store.ask("put the overdue card first", "Key metrics")

    const reloaded = createStore().getSnapshot()
    expect(reloaded.chats[0]?.title).toBe("put the overdue card first")
    expect(reloaded.active).toBe(reloaded.chats[0]?.id)
    expect(createStore("/tickets").getSnapshot().chats).toEqual([])
  })

  it("notifies subscribers of changes", () => {
    const store = createStore()
    let calls = 0
    const unsubscribe = store.subscribe(() => {
      calls++
    })

    store.ask("put the overdue card first", "Key metrics")
    unsubscribe()
    store.newChat()

    expect(calls).toBe(1)
  })

  it("keeps at most 20 chats, dropping the oldest", () => {
    const store = createStore()
    for (let index = 0; index < 25; index++) {
      store.newChat()
      store.ask(`ask ${String(index)}`, "Key metrics")
    }

    const { chats } = store.getSnapshot()
    expect(chats).toHaveLength(20)
    expect(chats[0]?.title).toBe("ask 24")
    expect(chats.at(-1)?.title).toBe("ask 5")
  })

  it("starts over from stored chats it can't read at all", () => {
    storage.setItem("pliant:ask-chats:/orders", "{not json")
    expect(createStore().getSnapshot()).toEqual({ active: null, chats: [] })

    storage.setItem("pliant:ask-chats:/orders", JSON.stringify({ chats: 1 }))
    expect(createStore().getSnapshot()).toEqual({ active: null, chats: [] })
  })

  it("drops only the stored chats and messages it can't read", () => {
    const store = createStore()
    const chatId = store.ask("put the overdue card first", "Key metrics")
    store.answer(chatId, { kind: "clarify", text: "Which card?" })
    const stored = JSON.parse(
      storage.getItem("pliant:ask-chats:/orders") ?? ""
    ) as { chats: { messages: unknown[] }[] }
    stored.chats[0]?.messages.push({ id: "x", kind: "teleport" })
    stored.chats.push({ messages: [] })
    storage.setItem("pliant:ask-chats:/orders", JSON.stringify(stored))

    const { active, chats } = createStore().getSnapshot()

    expect(active).toBe(chatId)
    expect(chats).toHaveLength(1)
    expect(chats[0]?.messages.map(({ kind }) => kind)).toEqual([
      "ask",
      "clarify",
    ])
  })

  it("shortens long text, so it still reads after a reload", () => {
    const store = createStore()
    const long = "x".repeat(5000)
    const chatId = store.ask(long, "Key metrics")
    for (const kind of ["clarify", "unavailable", "error"] as const) {
      store.answer(chatId, { kind, text: long })
    }
    store.answer(chatId, {
      kind: "change",
      target: "Key metrics",
      overlay: "01KAB0000000000000000000S1",
      ops: ["move"],
      explain: [long],
    })

    const messages = createStore().getSnapshot().chats[0]?.messages ?? []

    expect(messages).toHaveLength(5)
    for (const message of messages) {
      const texts =
        message.kind === "change"
          ? message.explain
          : "text" in message
            ? [message.text]
            : []
      for (const text of texts) {
        expect(text.length).toBeLessThanOrEqual(2000)
        expect(text.endsWith("…")).toBe(true)
      }
    }
  })

  it("keeps the last 40 messages of a chat", () => {
    const store = createStore()
    const chatId = store.ask("ask 0", "Key metrics")
    for (let index = 1; index < 45; index++) {
      store.answer(chatId, { kind: "clarify", text: `answer ${String(index)}` })
    }

    const messages = createStore().getSnapshot().chats[0]?.messages ?? []
    expect(messages).toHaveLength(40)
    expect(messages.at(-1)).toMatchObject({ text: "answer 44" })
    expect(messages[0]).toMatchObject({ text: "answer 5" })
  })

  it("keeps a decided preview's outcome across a reload", () => {
    const store = createStore()
    const chatId = store.ask("put the overdue card first", "Key metrics")
    store.answer(chatId, {
      kind: "change",
      target: "Key metrics",
      overlay: "01KAB0000000000000000000S1",
      ops: ["move"],
      explain: ["Moved the Overdue card first."],
    })
    const change = store.getSnapshot().chats[0]?.messages.at(-1)
    store.settle(chatId, change?.id ?? "", { outcome: "discarded" })

    expect(createStore().getSnapshot().chats[0]?.messages.at(-1)).toMatchObject(
      { kind: "change", outcome: "discarded" }
    )
  })

  it("keeps the chats of each scope apart under the pliant: prefix", () => {
    expect(pliantAskChatsKey("/orders")).toBe("pliant:ask-chats:/orders")
    const ada = createPliantAskChatStore(
      pliantAskChatsKey("/orders", "user:ada"),
      () => storage
    )
    ada.ask("put the overdue card first", "Key metrics")

    const grace = createPliantAskChatStore(
      pliantAskChatsKey("/orders", "user:grace"),
      () => storage
    )
    expect(grace.getSnapshot().chats).toEqual([])
    expect(createStore().getSnapshot().chats).toEqual([])
    expect(
      [...storage.items.keys()].every((key) => key.startsWith("pliant:"))
    ).toBe(true)
  })

  it("picks up chats another tab stores", () => {
    const store = createStore()
    let calls = 0
    const unsubscribe = store.subscribe(() => {
      calls++
    })
    createStore().ask("put the overdue card first", "Key metrics")

    window.dispatchEvent(
      new StorageEvent("storage", { key: "pliant:ask-chats:/orders" })
    )
    unsubscribe()

    expect(calls).toBe(1)
    expect(store.getSnapshot().chats[0]?.title).toBe(
      "put the overdue card first"
    )
  })

  it("keeps chats in memory when storage is blocked", () => {
    const store = createPliantAskChatStore(pliantAskChatsKey("/orders"), () => {
      throw new DOMException("Blocked", "SecurityError")
    })

    store.ask("put the overdue card first", "Key metrics")

    expect(store.getSnapshot().chats[0]?.title).toBe(
      "put the overdue card first"
    )
  })

  it("keeps chats in memory when storage is full", () => {
    const store = createStore()
    storage.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError")
    }

    store.ask("put the overdue card first", "Key metrics")
    store.ask("and hide orders", "Key metrics")

    expect(store.getSnapshot().chats[0]?.messages).toHaveLength(2)
  })
})
