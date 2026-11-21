/**
 * A form field's schema: any schema that implements Standard Schema, such
 * as a Zod schema, and validates synchronously.
 */
export interface FieldSchema {
  readonly "~standard": {
    readonly validate: (
      value: unknown
    ) => { readonly issues?: readonly unknown[] | undefined } | Promise<unknown>
  }
}
