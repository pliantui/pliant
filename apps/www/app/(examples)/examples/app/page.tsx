import type { Metadata } from "next"

import { StartPage } from "./components/start-page"

export const metadata: Metadata = {
  title: "Support desk",
}

export default function AppExamplePage() {
  return <StartPage />
}
