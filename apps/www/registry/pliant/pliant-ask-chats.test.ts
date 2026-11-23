import { describe, expect, it } from "vitest"

import { createPliantAskChatStore } from "./pliant-ask-chats"

function createStore() {
  return createPliantAskChatStore()
}

describe("createPliantAskChatStore", () => {
  it("starts with no chats and a new chat open, apart from other stores", () => {
    createStore().ask("put the overdue card first", "Key metrics")
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

  it("keeps the last 40 messages of a chat", () => {
    const store = createStore()
    const chatId = store.ask("ask 0", "Key metrics")
    for (let index = 1; index < 45; index++) {
      store.answer(chatId, { kind: "clarify", text: `answer ${String(index)}` })
    }

    const messages = store.getSnapshot().chats[0]?.messages ?? []
    expect(messages).toHaveLength(40)
    expect(messages.at(-1)).toMatchObject({ text: "answer 44" })
    expect(messages[0]).toMatchObject({ text: "answer 5" })
  })
})
