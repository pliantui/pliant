// #region form
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import * as z from "zod"

import { usePliantFormDefaults } from "@pliantui/react/form"

import { PliantForm } from "@/components/pliant/pliant-form"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const refundSchema = z.object({
  orderId: z.string().regex(/^ORD-\d{4}$/, "Order numbers look like ORD-1042."),
  amount: z.string().min(1, "Enter an amount."),
  reason: z.string().optional(),
  cc: z.string().optional(),
})

type Refund = z.infer<typeof refundSchema>

const refundDefaults: Refund = { orderId: "", amount: "", reason: "", cc: "" }

export function RefundForm({
  onSubmit,
}: {
  onSubmit: (refund: Refund) => void
}) {
  const values = usePliantFormDefaults("refund-form", refundDefaults, {
    schema: refundSchema,
  })
  const form = useForm<Refund>({
    resolver: zodResolver(refundSchema),
    values,
    resetOptions: { keepDirtyValues: true },
  })

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit(onSubmit)(event)
      }}
      className="flex flex-col gap-6"
    >
      <PliantForm
        id="refund-form"
        schema={refundSchema}
        fields={{
          orderId: (
            <Controller
              name="orderId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="refund-order">Order</FieldLabel>
                  <Input {...field} id="refund-order" placeholder="ORD-1042" />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          ),
          amount: (
            <Controller
              name="amount"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="refund-amount">Amount (₹)</FieldLabel>
                  <Input {...field} id="refund-amount" inputMode="decimal" />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          ),
          reason: (
            <Controller
              name="reason"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="refund-reason">Reason</FieldLabel>
                  <Textarea {...field} id="refund-reason" rows={3} />
                </Field>
              )}
            />
          ),
          cc: (
            <Controller
              name="cc"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="refund-cc">CC</FieldLabel>
                  <Input {...field} id="refund-cc" type="email" />
                </Field>
              )}
            />
          ),
        }}
      />
      <Button type="submit">Request refund</Button>
    </form>
  )
}
// #endregion form
