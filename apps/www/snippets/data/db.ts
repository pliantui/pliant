// Stands in for the app's own Postgres pool, such as `new Pool()` from `pg`,
// whose `query` is generic in the same way.
export const pool = {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  query<Row>(text: string, values: unknown[]) {
    return Promise.resolve({ rows: [] as Row[], text, values })
  },
}
