import type { DatasetGrant } from "@pliantui/server/data"
import { compileQuery, type ServerQuery } from "@pliantui/server/sql"

import { pool } from "./db"
import { ordersDataset } from "./orders-dataset"

export async function loadPage(grant: DatasetGrant, request: ServerQuery) {
  // #region query
  const query = compileQuery(ordersDataset, grant, request, { table: "orders" })
  const { rows } = await pool.query(query.text, query.values)
  // #endregion query
  return rows
}
