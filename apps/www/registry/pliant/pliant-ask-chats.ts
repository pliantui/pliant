import { useSyncExternalStore } from "react"
import * as z from "zod"

const maxChats = 20
const maxMessages = 40
const maxTitleLength = 60
const maxTextLength = 2000
const maxListLength = 500

const textSchema = z.string().max(maxTextLength)

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
    ops: z.array(textSchema).max(maxListLength),
    explain: z.array(textSchema).max(maxListLength),
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

// Stored chats are read loosely, so one entry that doesn't fit, as from an
// older version of this file, drops only itself.
const storedSchema = z.looseObject({
  active: z.string().nullable().catch(null),
  chats: z.array(z.unknown()).catch([]),
})

const storedChatSchema = z.looseObject({
  id: z.string(),
  title: textSchema,
  updatedAt: z.number(),
  messages: z.array(z.unknown()).catch([]),
})

/**
 * One entry of a chat: the user's ask, the change an answer previewed, a
 * question or reason the answer gave instead, an error, or a cancelled ask.
 */
type PliantAskChatMessage = z.infer<typeof messageSchema>

/** A chat, titled from its first ask. */
interface PliantAskChatEntry {
  id: string
  title: string
  updatedAt: number
  messages: PliantAskChatMessage[]
}

/**
 * The chats of one surface, most recently updated first, and the open one,
 * or `null` for a new chat that has no ask yet.
 */
interface PliantAskChats {
  active: string | null
  chats: PliantAskChatEntry[]
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never

type NewMessage = DistributiveOmit<PliantAskChatMessage, "id">

const empty: PliantAskChats = { active: null, chats: [] }

function createId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

function clip(text: string, length = maxTextLength) {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text
}

function titleOf(text: string) {
  return clip(text.trim().replace(/\s+/g, " "), maxTitleLength)
}

// Keeps every stored text within the limits that reading checks.
function clipMessage(message: NewMessage): NewMessage {
  switch (message.kind) {
    case "ask":
      return {
        ...message,
        text: clip(message.text),
        target: clip(message.target),
      }
    case "change":
      return {
        ...message,
        target: clip(message.target),
        overlay: clip(message.overlay),
        ops: message.ops.slice(0, maxListLength).map((op) => clip(op)),
        explain: message.explain
          .slice(0, maxListLength)
          .map((sentence) => clip(sentence)),
      }
    case "cancelled":
      return message
    default:
      return { ...message, text: clip(message.text) }
  }
}

function parse(stored: string | null): PliantAskChats {
  if (!stored) {
    return empty
  }
  let json: unknown
  try {
    json = JSON.parse(stored)
  } catch {
    return empty
  }
  const state = storedSchema.safeParse(json)
  if (!state.success) {
    return empty
  }
  const chats = state.data.chats
    .flatMap((entry) => {
      const chat = storedChatSchema.safeParse(entry)
      if (!chat.success) {
        return []
      }
      const messages = chat.data.messages.flatMap((message) => {
        const parsed = messageSchema.safeParse(message)
        return parsed.success ? [parsed.data] : []
      })
      return [
        {
          id: chat.data.id,
          title: chat.data.title,
          updatedAt: chat.data.updatedAt,
          messages: messages.slice(-maxMessages),
        },
      ]
    })
    .slice(0, maxChats)
  const active = state.data.active
  return {
    active: chats.some(({ id }) => id === active) ? active : null,
    chats,
  }
}

/**
 * The `localStorage` key of a surface's chats, with the `pliant:` prefix of
 * everything Pliant stores in the browser. A `scope`, such as a user id,
 * keeps the chats of each scope apart.
 */
function pliantAskChatsKey(surface: string, scope?: string) {
  return scope === undefined
    ? `pliant:ask-chats:${surface}`
    : `pliant:ask-chats:${encodeURIComponent(scope)}:${surface}`
}

function browserStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

/**
 * The chats stored under `key`, as `pliantAskChatsKey` makes it. Storage that
 * is missing, full or blocked leaves the chats in memory for the page's
 * lifetime, and stored chats or messages that can't be read are dropped.
 * Chats another tab changes show here through the `storage` event.
 */
function createPliantAskChatStore(
  key: string,
  getStorage: () => Storage | undefined = browserStorage
) {
  const listeners = new Set<() => void>()
  let state: PliantAskChats = empty
  // The stored text `state` was read from or written as; `undefined` before
  // the first read. Reading compares against it, so chats another tab or a
  // cleared storage changed are picked up.
  let raw: string | null | undefined
  let memoryOnly = false

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
    update: (chat: PliantAskChatEntry) => PliantAskChatEntry
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
      function onStorage(event: StorageEvent) {
        if (event.key === key || event.key === null) {
          listener()
        }
      }
      listeners.add(listener)
      if (typeof window !== "undefined") {
        window.addEventListener("storage", onStorage)
      }
      return () => {
        listeners.delete(listener)
        if (typeof window !== "undefined") {
          window.removeEventListener("storage", onStorage)
        }
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
        text: clip(text),
        target: clip(target),
      }
      const open = current.chats.find(({ id }) => id === current.active)
      if (open) {
        updateChat(open.id, (chat) => ({
          ...chat,
          messages: [...chat.messages, message].slice(-maxMessages),
        }))
        return open.id
      }
      const chat: PliantAskChatEntry = {
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
        messages: [
          ...chat.messages,
          { ...clipMessage(message), id: createId() },
        ].slice(-maxMessages),
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
 * panel of the surface and `scope`.
 */
function usePliantAskChats(surface: string, scope?: string) {
  const key = pliantAskChatsKey(surface, scope)
  let store = stores.get(key)
  if (!store) {
    store = createPliantAskChatStore(key)
    stores.set(key, store)
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
  pliantAskChatsKey,
  usePliantAskChats,
  type PliantAskChatEntry,
  type PliantAskChatMessage,
  type PliantAskChats,
  type PliantAskChatStore,
}
