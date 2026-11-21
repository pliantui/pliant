// #region providers
"use client"

import type { ReactNode } from "react"

import { PliantRoot, type PliantMessages } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"

const messages: Partial<PliantMessages> = {
  regionMore: "Plus",
  dataTableColumns: "Colonnes",
  dataTablePrevious: "Précédent",
  dataTableNext: "Suivant",
  dataTableRowsPerPage: "Lignes par page",
  dataTableRange: (first, last, total, rows) =>
    `${first}–${last} sur ${total} ${rows}`,
}

export function OrdersRoot({ children }: { children: ReactNode }) {
  return (
    <PliantRoot
      surface="/orders"
      storage={localAdapter}
      lang="fr-FR"
      messages={messages}
    >
      {children}
    </PliantRoot>
  )
}
// #endregion providers
