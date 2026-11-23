import { useSyncExternalStore } from "react"
import * as z from "zod"

const maxChats = 20
const maxMessages = 40
const maxTitleLength = 60

const textSchema = z.string().max(2000)

const messageSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string(),
    kind: z.literal("ask"),
    text: textSchema,
    target: textSchema,
  }),
  z.object({
    id: z.string(),
    kind: z.literal("change"),
    target: textSchema,
    overlay: z.string(),
    ops: z.array(z.string()).max(500),
    explain: z.array(textSchema).max(500),
    outcome: z.enum(["locked", "discarded"]).optional(),
    keptInSession: z.int().min(0).optional(),
  }),
  z.object({
    id: z.string(),
    kind: z.enum(["clarify", "unavailable", "error"]),
    text: textSchema,
  }),
  z.object({ id: z.string(), kind: z.literal("cancelled") }),
])

const chatSchema = z.object({
  id: z.string(),
  title: textSchema,
  updatedAt: z.number(),
  messages: z.array(messageSchema).max(maxMessages),
})

const stateSchema = z.object({
  active: z.string().nullable(),
  chats: z.array(chatSchema).max(maxChats),
})

/**
 * One entry of a chat: the user's ask, the change an answer previewed, a
 * question or reason the answer gave instead, an error, or a cancelled ask.
 */
type PliantAskChatMessage = z.infer<typeof messageSchema>

/** A chat, titled from its first ask. */
type PliantAskChat = z.infer<typeof chatSchema>

/**
 * The chats of one surface, most recently updated first, and the open one,
 * or `null` for a new chat that has no ask yet.
 */
type PliantAskChats = z.infer<typeof stateSchema>

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never

type NewMessage = DistributiveOmit<PliantAskChatMessage, "id">

const empty: PliantAskChats = { active: null, chats: [] }

function createId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

function titleOf(text: string) {
  const title = text.trim().replace(/\s+/g, " ")
  return title.length > maxTitleLength
    ? `${title.slice(0, maxTitleLength - 1)}…`
    : title
}

function browserStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

/**
 * The chats of one surface, kept in `storage` under a key for the surface.
 * Storage that is missing, full or blocked leaves the chats in memory for
 * the page's lifetime, and stored chats that can't be read start over empty.
 */
function createPliantAskChatStore(
  surface: string,
  getStorage: () => Storage | undefined = browserStorage
) {
  const key = `pliant-ask-chats:${surface}`
  const listeners = new Set<() => void>()
  let state: PliantAskChats = empty
  // The stored text `state` was read from or written as; `undefined` before
  // the first read. Reading compares against it, so chats another tab or a
  // cleared storage changed are picked up on the next render.
  let raw: string | null | undefined
  let memoryOnly = false

  function parse(stored: string | null): PliantAskChats {
    if (!stored) {
      return empty
    }
    try {
      const parsed = stateSchema.safeParse(JSON.parse(stored))
      return parsed.success ? parsed.data : empty
    } catch {
      return empty
    }
  }

  function getSnapshot() {
    if (memoryOnly) {
      return state
    }
    let stored: string | null
    try {
      const storage = getStorage()
      if (!storage) {
        memoryOnly = true
        return state
      }
      stored = storage.getItem(key)
    } catch {
      memoryOnly = true
      return state
    }
    if (stored !== raw) {
      raw = stored
      state = parse(stored)
    }
    return state
  }

  function set(next: PliantAskChats) {
    state = next
    if (!memoryOnly) {
      try {
        const text = JSON.stringify(next)
        getStorage()?.setItem(key, text)
        raw = text
      } catch {
        // Storage is full or blocked, so the chats stay in memory from now
        // on rather than fall back to what was stored.
        memoryOnly = true
      }
    }
    for (const listener of listeners) {
      listener()
    }
  }

  function updateChat(
    chatId: string,
    update: (chat: PliantAskChat) => PliantAskChat
  ) {
    const current = getSnapshot()
    const chat = current.chats.find(({ id }) => id === chatId)
    if (!chat) {
      return
    }
    const next = { ...update(chat), updatedAt: Date.now() }
    set({
      ...current,
      chats: [next, ...current.chats.filter(({ id }) => id !== chatId)],
    })
  }

  return {
    getSnapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    /** Opens a new chat, which is stored once it has an ask. */
    newChat: () => {
      set({ ...getSnapshot(), active: null })
    },
    switchChat: (chatId: string) => {
      const current = getSnapshot()
      if (current.chats.some(({ id }) => id === chatId)) {
        set({ ...current, active: chatId })
      }
    },
    deleteChat: (chatId: string) => {
      const current = getSnapshot()
      set({
        active: current.active === chatId ? null : current.active,
        chats: current.chats.filter(({ id }) => id !== chatId),
      })
    },
    /**
     * Adds an ask to the open chat, or to a new chat titled from it, and
     * returns the chat's id.
     */
    ask: (text: string, target: string) => {
      const current = getSnapshot()
      const message: PliantAskChatMessage = {
        id: createId(),
        kind: "ask",
        text,
        target,
      }
      const open = current.chats.find(({ id }) => id === current.active)
      if (open) {
        updateChat(open.id, (chat) => ({
          ...chat,
          messages: [...chat.messages, message].slice(-maxMessages),
        }))
        return open.id
      }
      const chat: PliantAskChat = {
        id: createId(),
        title: titleOf(text),
        updatedAt: Date.now(),
        messages: [message],
      }
      set({
        active: chat.id,
        chats: [chat, ...current.chats].slice(0, maxChats),
      })
      return chat.id
    },
    /** Adds an answer to a chat, open or not. */
    answer: (chatId: string, message: NewMessage) => {
      updateChat(chatId, (chat) => ({
        ...chat,
        messages: [...chat.messages, { ...message, id: createId() }].slice(
          -maxMessages
        ),
      }))
    },
    /** Records whether a previewed change was locked in or discarded. */
    settle: (
      chatId: string,
      messageId: string,
      outcome:
        | { outcome: "locked"; keptInSession: number }
        | {
            outcome: "discarded"
          }
    ) => {
      updateChat(chatId, (chat) => ({
        ...chat,
        messages: chat.messages.map((message) =>
          message.id === messageId && message.kind === "change"
            ? { ...message, ...outcome }
            : message
        ),
      }))
    },
  }
}

type PliantAskChatStore = ReturnType<typeof createPliantAskChatStore>

const stores = new Map<string, PliantAskChatStore>()

function getServerSnapshot() {
  return empty
}

/**
 * The chats of a surface, stored in this browser only, shared by every ask
 * panel of the surface.
 */
function usePliantAskChats(surface: string) {
  let store = stores.get(surface)
  if (!store) {
    store = createPliantAskChatStore(surface)
    stores.set(surface, store)
  }
  const chats = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    getServerSnapshot
  )
  return { chats, store }
}

export {
  createPliantAskChatStore,
  usePliantAskChats,
  type PliantAskChat,
  type PliantAskChatMessage,
  type PliantAskChats,
  type PliantAskChatStore,
}
