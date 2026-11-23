import { useSyncExternalStore } from "react"

const maxChats = 20
const maxMessages = 40
const maxTitleLength = 60

/**
 * One entry of a chat: the user's ask, the change an answer previewed, a
 * question or reason the answer gave instead, an error, or a cancelled ask.
 */
type PliantAskChatMessage =
  | { id: string; kind: "ask"; text: string; target: string }
  | {
      id: string
      kind: "change"
      target: string
      overlay: string
      ops: string[]
      explain: string[]
      outcome?: "locked" | "discarded"
      keptInSession?: number
    }
  | { id: string; kind: "clarify" | "unavailable" | "error"; text: string }
  | { id: string; kind: "cancelled" }
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

function titleOf(text: string) {
  const title = text.trim().replace(/\s+/g, " ")
  return title.length > maxTitleLength
    ? `${title.slice(0, maxTitleLength - 1)}…`
    : title
}

/**
 * A page's chats, kept in memory only: they clear when the page unloads.
 */
function createPliantAskChatStore() {
  const listeners = new Set<() => void>()
  let state: PliantAskChats = empty

  function getSnapshot() {
    return state
  }

  function set(next: PliantAskChats) {
    state = next
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
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    /** Opens a new chat, which is kept once it has an ask. */
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

function getServerSnapshot() {
  return empty
}

/** The chats in `store`, kept current. */
function usePliantAskChats(store: PliantAskChatStore) {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    getServerSnapshot
  )
}

export {
  createPliantAskChatStore,
  usePliantAskChats,
  type PliantAskChatEntry,
  type PliantAskChatMessage,
  type PliantAskChats,
  type PliantAskChatStore,
}
