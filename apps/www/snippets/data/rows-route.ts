// #region route
import { authorizeDataset } from "@pliantui/server/data"
import { compileQuery, type ServerQuery } from "@pliantui/server/sql"

import { pool } from "./db"
import { ordersDataset } from "./orders-dataset"
import { getSessionUser } from "./session"

export async function POST(request: Request) {
  const user = getSessionUser(request)
  if (!user) return new Response(null, { status: 401 })

  const grant = authorizeDataset(ordersDataset, user)
  if (!grant) return new Response(null, { status: 403 })

  // compileQuery checks the query itself, and throws a TypeError if it's
  // malformed or asks for more than this user may see.
  const body = (await request.json()) as ServerQuery

  try {
    const query = compileQuery(ordersDataset, grant, body, {
      table: "orders",
      columns: { createdAt: "created_at", orgId: "org_id" },
      maxPageSize: 100,
    })
    const [{ rows }, count] = await Promise.all([
      pool.query(query.text, query.values),
      // The same scope as the grant: every order in the user's org.
      pool.query<{ count: number }>(
        "select count(*)::int as count from orders where org_id = $1",
        [user.orgId]
      ),
    ])
    return Response.json({ rows, rowCount: count.rows[0]?.count ?? 0 })
  } catch (error) {
    if (error instanceof TypeError) {
      return Response.json({ message: error.message }, { status: 400 })
    }
    throw error
  }
}
// #endregion route
