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
  usePliantSurface,
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
  type PliantAskChatMessage,
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
  askNoChats: "No saved chats",
  askDeleteChat: "Delete this chat",
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

function ChangeMessage({
  message,
  live,
  disabled,
  onLockIn,
  onDiscard,
}: {
  message: Extract<PliantAskChatMessage, { kind: "change" }>
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
}: {
  panel: PliantAskPanelState
  targets: readonly PliantAskTarget[]
  placeholder: string | undefined
  titleId: string
  /** Moves focus to the prompt when the chat mounts. */
  autoFocus: boolean
  /** Where the panel reports each answer before it previews it. */
  answers: Set<(answer: PliantAskAnswer) => void>
}) {
  const messages = usePliantMessages(askChatMessages)
  const surface = usePliantSurface()
  const { chats, store } = usePliantAskChats(surface)
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
    const chatId = store.ask(text, panel.target.label)
    pending.current = { chatId, target: panel.target.label }
    panel.ask()
    panel.setPrompt("")
  }

  function decide(messageId: string, action: () => void) {
    if (chat) {
      decision.current = { chatId: chat.id, messageId }
      action()
    }
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
                <DropdownMenuItem
                  variant="destructive"
                  disabled={asking}
                  onSelect={() => {
                    store.deleteChat(chat.id)
                  }}
                >
                  {messages.askDeleteChat}
                </DropdownMenuItem>
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
        className="min-h-0"
        aria-label={messages.askConversation}
        aria-live="polite"
      >
        <ConversationContent className="gap-4">
          {chatMessages.length === 0 && !asking ? (
            <ConversationEmptyState
              icon={<SparklesIcon className="size-5" />}
              title={messages.askEmptyTitle}
              description={messages.askDescription}
            />
          ) : (
            chatMessages.map((message) => {
              switch (message.kind) {
                case "ask":
                  return (
                    <Message key={message.id} from="user">
                      <MessageContent>
                        <span className="text-xs text-muted-foreground">
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
                      live={preview?.id === message.overlay}
                      disabled={asking}
                      onLockIn={() => {
                        decide(message.id, panel.lockIn)
                      }}
                      onDiscard={() => {
                        decide(message.id, panel.discard)
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
