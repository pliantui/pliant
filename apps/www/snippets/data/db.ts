// Stands in for the app's own Postgres pool, such as `new Pool()` from `pg`.
export const pool = {
  query(text: string, values: unknown[]) {
    return Promise.resolve({ rows: [] as unknown[], text, values })
  },
}
