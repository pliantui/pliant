// #region start
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { usePliantNav } from "@pliantui/react/nav"

import { items } from "./nav-items"

export function StartPageRedirect() {
  const router = useRouter()
  const { landing } = usePliantNav("app-sidebar", items)
  const url = landing ? items[landing]?.url : undefined

  useEffect(() => {
    if (url) router.replace(url)
  }, [router, url])

  return null
}
// #endregion start
