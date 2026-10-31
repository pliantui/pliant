import { HomeLayout } from "fumadocs-ui/layouts/home"

import { baseOptions } from "@/lib/layout-options"

export default function Layout({ children }: LayoutProps<"/">) {
  return <HomeLayout {...baseOptions()}>{children}</HomeLayout>
}
