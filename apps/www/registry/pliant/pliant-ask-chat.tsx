"use client"

import * as React from "react"
import { cn } from "cn"
import {
  ChevronDownIcon,
  ListChecksIcon,
  PlusIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react"
import * as z from "zod"

import type { OpName } from "@pliantui/contract"
import {
  usePliantMessages,
  usePreview,
  type PliantMessages,
} from "@pliantui/react"
import type { useAskPanel } from "@pliantui/react/ask"

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { Message, MessageContent } from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input"
import {
  Task,
  TaskContent,
  TaskItem,
  TaskTrigger,
} from "@/components/ai-elements/task"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

import {
  usePliantAskChats,
  type PliantAskChatEntry,
  type PliantAskChatMessage,
  type PliantAskChatStore,
} from "./pliant-ask-chats"
import type { PliantAskAnswer, PliantAskTarget } from "./pliant-ask-panel"
import { pliantAskChosenOps, pliantAskOpLabels } from "./pliant-ask-steps"

declare module "@pliantui/react" {
  interface PliantMessages {
    askTitle: string
    askDescription: string
    askClose: string
    askChats: string
    askCurrentChat: string
    askNewChat: string
    askNoChats: string
    askDeleteChat: string
    askConfirmDelete: string
    askNotSaved: string
    askConversation: string
    askEmptyTitle: string
    askScrollDown: string
    askTargetLabel: string
    askPromptLabel: string
    askPromptPlaceholder: string
    askPromptHint: string
    askCancel: string
    askSend: string
    askAsking: string
    askCancelled: string
    askSteps: string
    /** A step that names an op the answer chose, by its `askOpLabel`. */
    askStepChoseOp: (label: string) => string
    /** The step that says the change passed the target's checks. */
    askStepChecked: (target: string) => string
    askOpLabel: (op: OpName) => string
    askPreview: string
    askPreviewing: string
    askNotPreviewed: string
    askOtherPreview: string
    askGoToChat: string
    askDiscarded: string
    askLockedIn: string
    askKeptInSession: (count: number) => string
    askLockIn: string
    askDiscard: string
    askSuggestions: string
  }
}

const askChatMessages = {
  askTitle: "Ask",
  askDescription:
    "Describe how this page should look. You see a preview, and nothing is saved until you lock it in.",
  askClose: "Close",
  askChats: "Chats",
  askCurrentChat: "Current chat:",
  askNewChat: "New chat",
  askNoChats: "No chats yet",
  askDeleteChat: "Delete this chat",
  askConfirmDelete: "Delete",
  askNotSaved: "Chats aren't saved. They clear when you leave the page.",
  askConversation: "Conversation",
  askEmptyTitle: "Ask for a change",
  askScrollDown: "Scroll to the latest message",
  askTargetLabel: "Change",
  askPromptLabel: "Ask",
  askPromptPlaceholder: "Describe a change",
  askPromptHint: "Enter to send, Shift+Enter for a new line.",
  askCancel: "Cancel",
  askSend: "Send",
  askAsking: "Asking…",
  askCancelled: "Cancelled.",
  askSteps: "Steps",
  askStepChoseOp: (label) => `Chose an operation: ${label}`,
  askStepChecked: (target) =>
    `Checked the change against the rules for ${target}`,
  askOpLabel: (op) => pliantAskOpLabels[op],
  askPreview: "Preview",
  askPreviewing: "Showing on the page. Nothing is saved until you lock it in.",
  askNotPreviewed: "No longer previewed.",
  askOtherPreview: "A preview from another ask is showing on the page.",
  askGoToChat: "Go to chat",
  askDiscarded: "Discarded.",
  askLockedIn: "Locked in.",
  askKeptInSession: (count) =>
    count === 1
      ? "1 change stays for this session only."
      : `${String(count)} changes stay for this session only.`,
  askLockIn: "Lock in",
  askDiscard: "Discard",
  askSuggestions: "Suggestions",
} satisfies Partial<PliantMessages>

const maxPromptLength = 500

// The preview already passed the store's checks, so only the parts the chat
// keeps are read here.
const answeredOverlaySchema = z.looseObject({
  id: z.string(),
  ops: z.array(z.looseObject({ op: z.string() })),
  explain: z.array(z.string()).optional(),
})

type PliantAskPanelState = ReturnType<typeof useAskPanel<PliantAskTarget>>

interface PendingAsk {
  chatId: string
  target: string
  answer?: PliantAskAnswer
}

interface PendingDecision {
  chatId: string
  messageId: string
}

// Where the change being previewed came from, if a chat holds it.
function findPreviewOwner(
  chats: readonly PliantAskChatEntry[],
  overlayId: string
) {
  for (const chat of chats) {
    const message = chat.messages.find(
      (entry) =>
        entry.kind === "change" &&
        entry.overlay === overlayId &&
        entry.outcome === undefined
    )
    if (message) {
      return { chatId: chat.id, messageId: message.id }
    }
  }
  return undefined
}

function ChangeMessage({
  message,
  label,
  live,
  disabled,
  onLockIn,
  onDiscard,
}: {
  message: Extract<PliantAskChatMessage, { kind: "change" }>
  label: React.ReactNode
  live: boolean
  disabled: boolean
  onLockIn: () => void
  onDiscard: () => void
}) {
  const messages = usePliantMessages(askChatMessages)
  const replyId = React.useId()
  const explain = [...new Set(message.explain)]
  const steps = [
    ...pliantAskChosenOps(message.ops).map((op) =>
      messages.askStepChoseOp(messages.askOpLabel(op))
    ),
    messages.askStepChecked(message.target),
  ]

  return (
    <Message from="assistant">
      <MessageContent className="w-full">
        {label}
        <div id={replyId} className="flex flex-col gap-1 break-words">
          {explain.map((sentence) => (
            <p key={sentence}>{sentence}</p>
          ))}
        </div>
        <Task>
          <TaskTrigger title={messages.askSteps}>
            <button
              type="button"
              className="flex w-fit items-center gap-2 rounded-sm text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <ListChecksIcon className="size-4" />
              {messages.askSteps}
              <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
            </button>
          </TaskTrigger>
          <TaskContent>
            <ol className="flex flex-col gap-1">
              {steps.map((step) => (
                <li key={step}>
                  <TaskItem>{step}</TaskItem>
                </li>
              ))}
            </ol>
          </TaskContent>
        </Task>
        <div
          role="group"
          aria-label={messages.askPreview}
          className="flex flex-col gap-2 rounded-md border p-3"
        >
          <Badge variant="secondary">{messages.askPreview}</Badge>
          {message.outcome === "locked" ? (
            <>
              <p>{messages.askLockedIn}</p>
              {message.keptInSession !== undefined &&
                message.keptInSession > 0 && (
                  <p className="text-muted-foreground">
                    {messages.askKeptInSession(message.keptInSession)}
                  </p>
                )}
            </>
          ) : message.outcome === "discarded" ? (
            <p>{messages.askDiscarded}</p>
          ) : live ? (
            <>
              <p className="text-muted-foreground">{messages.askPreviewing}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  aria-describedby={replyId}
                  disabled={disabled}
                  onClick={onLockIn}
                >
                  {messages.askLockIn}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-describedby={replyId}
                  disabled={disabled}
                  onClick={onDiscard}
                >
                  {messages.askDiscard}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">{messages.askNotPreviewed}</p>
          )}
        </div>
      </MessageContent>
    </Message>
  )
}

/**
 * The inside of `PliantAskPanel`: a chat about the page, with a switcher
 * between the surface's chats. It is loaded when the panel first opens.
 */
function PliantAskChat({
  panel,
  targets,
  placeholder,
  titleId,
  autoFocus,
  answers,
  store,
  answerLabel,
}: {
  panel: PliantAskPanelState
  targets: readonly PliantAskTarget[]
  placeholder: string | undefined
  titleId: string
  /** Moves focus to the prompt when the chat mounts. */
  autoFocus: boolean
  /** Where the panel reports each answer before it previews it. */
  answers: Set<(answer: PliantAskAnswer) => void>
  /** The page's chats, which outlive the chat while the panel is closed. */
  store: PliantAskChatStore
  /** Heads the answer to an ask, by the ask's target id and prompt. */
  answerLabel?:
    ((ask: { target: string; prompt: string }) => React.ReactNode) | undefined
}) {
  const messages = usePliantMessages(askChatMessages)
  const chats = usePliantAskChats(store)
  const preview = usePreview()
  const [promptElement, setPromptElement] =
    React.useState<HTMLTextAreaElement | null>(null)
  const hintId = React.useId()
  const pending = React.useRef<PendingAsk | null>(null)
  const decision = React.useRef<PendingDecision | null>(null)
  const { state } = panel
  const asking = state.status === "asking"
  const chat = chats.chats.find(({ id }) => id === chats.active)
  const chatMessages = chat?.messages ?? []
  const suggestions = panel.target?.suggestions ?? []
  const previewOwner = preview
    ? findPreviewOwner(chats.chats, preview.id)
    : undefined
  // A preview no message of the open chat shows, as from another chat or
  // from outside the panel, keeps its controls in a bar of its own.
  const otherPreview = preview !== null && previewOwner?.chatId !== chat?.id

  React.useEffect(() => {
    if (autoFocus) {
      promptElement?.focus()
    }
  }, [autoFocus, promptElement])

  React.useEffect(() => {
    function onAnswer(answer: PliantAskAnswer) {
      if (pending.current) {
        pending.current.answer = answer
      }
    }
    answers.add(onAnswer)
    return () => {
      answers.delete(onAnswer)
    }
  }, [answers])

  // An ask the panel cancels by closing never reaches the effect below.
  React.useEffect(
    () => () => {
      if (pending.current) {
        store.answer(pending.current.chatId, { kind: "cancelled" })
        pending.current = null
      }
    },
    [store]
  )

  // Layout, so a decided preview never paints as no longer previewed.
  React.useLayoutEffect(() => {
    const decided = decision.current
    if (decided) {
      decision.current = null
      if (state.status === "locked") {
        store.settle(decided.chatId, decided.messageId, {
          outcome: "locked",
          keptInSession: state.keptInSession.length,
        })
      } else if (state.status === "discarded") {
        store.settle(decided.chatId, decided.messageId, {
          outcome: "discarded",
        })
      } else if (state.status === "failed") {
        store.answer(decided.chatId, { kind: "error", text: state.message })
      }
      return
    }
    const ask = pending.current
    if (!ask || state.status === "asking") {
      return
    }
    pending.current = null
    if (state.status === "idle" && ask.answer?.status === "ok") {
      const overlay = answeredOverlaySchema.safeParse(ask.answer.overlay)
      if (overlay.success) {
        store.answer(ask.chatId, {
          kind: "change",
          target: ask.target,
          overlay: overlay.data.id,
          ops: overlay.data.ops.map(({ op }) => op),
          explain: overlay.data.explain ?? [],
        })
      }
    } else if (state.status === "clarify") {
      store.answer(ask.chatId, { kind: "clarify", text: state.question })
    } else if (state.status === "unavailable") {
      store.answer(ask.chatId, { kind: "unavailable", text: state.reason })
    } else if (state.status === "failed") {
      store.answer(ask.chatId, { kind: "error", text: state.message })
    } else if (state.status === "cancelled") {
      store.answer(ask.chatId, { kind: "cancelled" })
    }
  }, [state, store])

  function send() {
    const text = panel.prompt.trim()
    if (asking || text === "" || !panel.target) {
      return
    }
    const chatId = store.ask(text, panel.target.label, panel.target.id)
    pending.current = { chatId, target: panel.target.label }
    panel.ask()
    panel.setPrompt("")
  }

  // A preview no chat holds reports a failure to the open chat.
  function decide(owner: PendingDecision | undefined, action: () => void) {
    decision.current =
      owner ?? (chat ? { chatId: chat.id, messageId: "" } : null)
    action()
  }

  function deleteChat(chatId: string) {
    if (previewOwner?.chatId === chatId) {
      panel.discard()
    }
    store.deleteChat(chatId)
  }

  return (
    <>
      <div className="flex items-center gap-1 border-b py-2 pr-2 pl-4">
        <h2 id={titleId} className="mr-auto font-semibold">
          {messages.askTitle}
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="max-w-44 min-w-0"
              disabled={asking}
            >
              <span className="sr-only">{messages.askCurrentChat} </span>
              <span className="truncate">
                {chat?.title ?? messages.askNewChat}
              </span>
              <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>{messages.askChats}</DropdownMenuLabel>
            {chats.chats.length > 0 ? (
              <DropdownMenuRadioGroup
                value={chats.active ?? ""}
                onValueChange={(chatId) => {
                  store.switchChat(chatId)
                }}
              >
                {chats.chats.map((entry) => (
                  <DropdownMenuRadioItem key={entry.id} value={entry.id}>
                    <span className="truncate">{entry.title}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            ) : (
              <DropdownMenuItem disabled>
                {messages.askNoChats}
              </DropdownMenuItem>
            )}
            {chat && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    {messages.askDeleteChat}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => {
                        deleteChat(chat.id)
                      }}
                    >
                      {messages.askConfirmDelete}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={messages.askNewChat}
          disabled={asking}
          onClick={() => {
            store.newChat()
            promptElement?.focus()
          }}
        >
          <PlusIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={messages.askClose}
          onClick={() => {
            panel.setOpen(false)
          }}
        >
          <XIcon />
        </Button>
      </div>
      <div className="flex items-center gap-2 px-4 pt-3">
        <span id={`${titleId}-target`} className="text-sm font-medium">
          {messages.askTargetLabel}
        </span>
        <Select
          value={panel.target?.id ?? ""}
          onValueChange={panel.setTarget}
          disabled={asking}
        >
          <SelectTrigger
            {...panel.getPickerProps()}
            aria-labelledby={`${titleId}-target`}
            size="sm"
            className="min-w-0 flex-1"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {targets.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Conversation
        // A new log for each chat, so switching doesn't announce every
        // message again.
        key={chats.active ?? "new"}
        className="min-h-0"
        aria-label={messages.askConversation}
        aria-live="polite"
      >
        <ConversationContent className="gap-4">
          {chatMessages.length === 0 && !asking ? (
            <ConversationEmptyState>
              <SparklesIcon className="size-5 text-muted-foreground" />
              <div className="space-y-1">
                <h3 className="text-sm font-medium">
                  {messages.askEmptyTitle}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {messages.askDescription}
                </p>
                <p className="text-xs text-muted-foreground">
                  {messages.askNotSaved}
                </p>
              </div>
            </ConversationEmptyState>
          ) : (
            chatMessages.map((message, index) => {
              const ask = chatMessages
                .slice(0, index)
                .findLast((entry) => entry.kind === "ask")
              const label =
                ask && answerLabel?.({ target: ask.targetId, prompt: ask.text })
              switch (message.kind) {
                case "ask":
                  return (
                    <Message key={message.id} from="user">
                      <MessageContent>
                        <span className="text-xs font-medium text-secondary-foreground">
                          {message.target}
                        </span>
                        <p className="break-words whitespace-pre-wrap">
                          {message.text}
                        </p>
                      </MessageContent>
                    </Message>
                  )
                case "change":
                  return (
                    <ChangeMessage
                      key={message.id}
                      message={message}
                      label={label}
                      live={preview?.id === message.overlay}
                      disabled={asking}
                      onLockIn={() => {
                        decide(
                          chat && { chatId: chat.id, messageId: message.id },
                          panel.lockIn
                        )
                      }}
                      onDiscard={() => {
                        decide(
                          chat && { chatId: chat.id, messageId: message.id },
                          panel.discard
                        )
                      }}
                    />
                  )
                case "cancelled":
                  return (
                    <Message key={message.id} from="assistant">
                      <MessageContent className="text-muted-foreground">
                        <p>{messages.askCancelled}</p>
                      </MessageContent>
                    </Message>
                  )
                default:
                  return (
                    <Message key={message.id} from="assistant">
                      <MessageContent
                        className={cn(
                          "break-words",
                          message.kind === "unavailable" &&
                            "text-muted-foreground",
                          message.kind === "error" && "text-destructive"
                        )}
                      >
                        {label}
                        <p>{message.text}</p>
                      </MessageContent>
                    </Message>
                  )
              }
            })
          )}
          {asking && (
            <Message from="assistant">
              <MessageContent className="w-full">
                <span className="sr-only">{messages.askAsking}</span>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton aria-label={messages.askScrollDown} />
      </Conversation>
      {otherPreview && (
        <div
          role="group"
          aria-label={messages.askPreview}
          className="mx-4 mb-3 flex flex-col gap-2 rounded-md border p-3 text-sm"
        >
          <p className="text-muted-foreground">{messages.askOtherPreview}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={asking}
              onClick={() => {
                decide(previewOwner, panel.lockIn)
              }}
            >
              {messages.askLockIn}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={asking}
              onClick={() => {
                decide(previewOwner, panel.discard)
              }}
            >
              {messages.askDiscard}
            </Button>
            {previewOwner && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={asking}
                onClick={() => {
                  store.switchChat(previewOwner.chatId)
                  promptElement?.focus()
                }}
              >
                {messages.askGoToChat}
              </Button>
            )}
          </div>
        </div>
      )}
      {suggestions.length > 0 && chatMessages.length === 0 && (
        <div
          role="group"
          aria-label={messages.askSuggestions}
          className="flex flex-wrap gap-2 px-4 pb-3"
        >
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              type="button"
              variant="secondary"
              size="sm"
              className="h-auto py-1 text-left whitespace-normal"
              disabled={asking}
              onClick={() => {
                panel.setPrompt(suggestion)
              }}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      )}
      <PromptInput className="px-4 pb-4" onSubmit={send}>
        <PromptInputBody>
          <PromptInputTextarea
            {...panel.getPromptProps({ ref: setPromptElement })}
            // Replaces the panel's Enter handler, so a sent ask also joins
            // the chat and clears the prompt.
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing &&
                // Safari ends a composition with an Enter whose isComposing
                // is false; only its keyCode tells.
                // eslint-disable-next-line @typescript-eslint/no-deprecated
                event.keyCode !== 229
              ) {
                event.preventDefault()
                send()
              }
            }}
            aria-label={messages.askPromptLabel}
            aria-describedby={hintId}
            maxLength={maxPromptLength}
            placeholder={placeholder ?? messages.askPromptPlaceholder}
          />
        </PromptInputBody>
        <PromptInputFooter>
          <p id={hintId} className="text-xs font-normal">
            {messages.askPromptHint}
          </p>
          <PromptInputTools>
            {asking && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={panel.cancel}
              >
                {messages.askCancel}
              </Button>
            )}
            <PromptInputSubmit
              aria-label={messages.askSend}
              status={asking ? "submitted" : "ready"}
              disabled={asking || panel.prompt.trim() === ""}
            />
          </PromptInputTools>
        </PromptInputFooter>
      </PromptInput>
    </>
  )
}

export { PliantAskChat }
