// @vitest-environment happy-dom
import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { Controller, useForm } from "react-hook-form"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as z from "zod"

import {
  PliantRoot,
  usePliantStore,
  type PliantStore,
  type StorageAdapter,
} from "@pliantui/react"
import { usePliantFormDefaults } from "@pliantui/react/form"

import { PliantForm } from "./pliant-form"

const surface = "/tickets"

type Op = Parameters<PliantStore["applyOps"]>[1][number]

const storage: StorageAdapter = {
  load: () => ({}),
  save: (_surface, saved) => ({
    overlay: saved,
    etag: crypto.randomUUID(),
    version: 1,
    updatedAt: new Date().toISOString(),
  }),
}

const schema = z.object({
  subject: z.string().min(5, "Too short."),
  priority: z.enum(["low", "normal", "high"]),
  cc: z.union([z.email("Not an email."), z.literal("")]).optional(),
})

type Ticket = z.infer<typeof schema>

const defaults: Ticket = { subject: "", priority: "normal", cc: "" }

let store: PliantStore | undefined

function TicketForm({ onSubmit }: { onSubmit: (ticket: Ticket) => void }) {
  const actions = usePliantStore()
  React.useLayoutEffect(() => {
    store = actions
  }, [actions])
  const values = usePliantFormDefaults("ticket-form", defaults, { schema })
  const form = useForm<Ticket>({
    resolver: zodResolver(schema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const field = (name: keyof Ticket, label: string) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field: { value, ...props }, fieldState }) => (
        <label>
          {label}
          <input
            {...props}
            value={value ?? ""}
            aria-invalid={fieldState.invalid}
          />
          <span>{fieldState.error?.message}</span>
        </label>
      )}
    />
  )
  return (
    <form
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit(onSubmit)(event)
      }}
    >
      <PliantForm
        id="ticket-form"
        schema={schema}
        fields={{
          subject: field("subject", "Subject"),
          priority: field("priority", "Priority"),
          cc: field("cc", "CC"),
        }}
      />
      <button type="submit">Submit</button>
    </form>
  )
}

async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
}

async function renderForm(onSubmit: (ticket: Ticket) => void = vi.fn()) {
  render(
    <PliantRoot surface={surface} storage={storage}>
      <TicketForm onSubmit={onSubmit} />
    </PliantRoot>
  )
  await settle()
}

async function apply(...ops: Op[]) {
  act(() => {
    expect(store?.applyOps("session", ops).success).toBe(true)
  })
  await settle()
}

function textbox(name: string) {
  return screen.getByRole<HTMLInputElement>("textbox", { name, hidden: true })
}

function moreFields() {
  return screen.getByRole("button", { name: "More fields" })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  store = undefined
})

describe("PliantForm", () => {
  it("keeps what the user typed when a field moves, collapses or hides", async () => {
    await renderForm()
    fireEvent.change(textbox("CC"), { target: { value: "ana@example.com" } })
    const input = textbox("CC")

    await apply(
      { op: "move", target: "ticket-form/fields/cc", to: { index: 0 } },
      { op: "collapse", target: "ticket-form", items: ["cc"], into: "more" }
    )
    fireEvent.click(moreFields())
    await apply({ op: "hide", target: "ticket-form/fields/cc" })
    await apply({ op: "show", target: "ticket-form/fields/cc" })

    expect(textbox("CC")).toBe(input)
    expect(textbox("CC").value).toBe("ana@example.com")
  })

  it("opens More fields when a field inside is invalid on submit", async () => {
    const onSubmit = vi.fn()
    await renderForm(onSubmit)
    await apply({
      op: "collapse",
      target: "ticket-form",
      items: ["cc"],
      into: "more",
    })
    fireEvent.change(textbox("Subject"), { target: { value: "Late refund" } })
    fireEvent.change(textbox("CC"), { target: { value: "not an email" } })
    expect(moreFields().getAttribute("aria-expanded")).toBe("false")

    fireEvent.click(screen.getByRole("button", { name: "Submit" }))
    await vi.waitFor(() => {
      expect(moreFields().getAttribute("aria-expanded")).toBe("true")
    })
    expect(screen.getByText("Not an email.")).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("starts the form with the defaults the user set", async () => {
    await renderForm()
    await apply({
      op: "setDefault",
      target: "ticket-form/fields/priority",
      value: "high",
    })
    expect(textbox("Priority").value).toBe("high")

    const rejected = store?.applyOps("session", [
      { op: "setDefault", target: "ticket-form/fields/priority", value: "x" },
    ])
    expect(rejected?.success).toBe(false)
    await settle()
    expect(textbox("Priority").value).toBe("high")
  })
})
