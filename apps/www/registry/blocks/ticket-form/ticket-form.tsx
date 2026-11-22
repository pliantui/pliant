"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import * as z from "zod"

import { usePliantFormDefaults } from "@pliantui/react/form"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PliantForm } from "@/registry/pliant/pliant-form"

const ticketSchema = z.object({
  subject: z
    .string()
    .min(5, "Subject must be at least 5 characters.")
    .max(80, "Subject must be at most 80 characters."),
  description: z
    .string()
    .min(20, "Description must be at least 20 characters."),
  priority: z.enum(["low", "normal", "high"]),
  orderId: z
    .string()
    .regex(/^(ORD-\d{4})?$/, "Order numbers look like ORD-1042.")
    .optional(),
  cc: z.union([z.email("Enter an email address."), z.literal("")]).optional(),
})

type Ticket = z.infer<typeof ticketSchema>

const ticketDefaults: Ticket = {
  subject: "",
  description: "",
  priority: "normal",
  orderId: "",
  cc: "",
}

export function TicketForm() {
  const [submitted, setSubmitted] = React.useState<Ticket | null>(null)
  const values = usePliantFormDefaults("ticket-form", ticketDefaults, {
    schema: ticketSchema,
  })
  const form = useForm<Ticket>({
    resolver: zodResolver(ticketSchema),
    values,
    resetOptions: { keepDirtyValues: true },
  })

  function onSubmit(ticket: Ticket) {
    setSubmitted(ticket)
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit(onSubmit)(event)
      }}
      className="flex flex-col gap-7"
    >
      <PliantForm
        id="ticket-form"
        schema={ticketSchema}
        fields={{
          subject: (
            <Controller
              name="subject"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="ticket-form-subject">Subject</FieldLabel>
                  <Input
                    {...field}
                    id="ticket-form-subject"
                    aria-invalid={fieldState.invalid}
                    placeholder="Refund not received"
                    autoComplete="off"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          ),
          description: (
            <Controller
              name="description"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="ticket-form-description">
                    Description
                  </FieldLabel>
                  <Textarea
                    {...field}
                    id="ticket-form-description"
                    aria-invalid={fieldState.invalid}
                    placeholder="I returned my order two weeks ago and haven't been refunded yet."
                    rows={4}
                  />
                  <FieldDescription>
                    Include what you expected and what happened instead.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          ),
          priority: (
            <Controller
              name="priority"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="ticket-form-priority">
                    Priority
                  </FieldLabel>
                  <Select
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      id="ticket-form-priority"
                      aria-invalid={fieldState.invalid}
                      onBlur={field.onBlur}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
          ),
          orderId: (
            <Controller
              name="orderId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="ticket-form-order-id">
                    Order number
                  </FieldLabel>
                  <Input
                    {...field}
                    id="ticket-form-order-id"
                    aria-invalid={fieldState.invalid}
                    placeholder="ORD-1042"
                    autoComplete="off"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          ),
          cc: (
            <Controller
              name="cc"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="ticket-form-cc">CC</FieldLabel>
                  <Input
                    {...field}
                    id="ticket-form-cc"
                    type="email"
                    aria-invalid={fieldState.invalid}
                    placeholder="teammate@example.com"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          ),
        }}
      />
      <div className="flex gap-2">
        <Button type="submit">Submit ticket</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            form.reset()
            setSubmitted(null)
          }}
        >
          Clear
        </Button>
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {submitted &&
          `Ticket "${submitted.subject}" submitted with ${submitted.priority} priority.`}
      </p>
    </form>
  )
}
