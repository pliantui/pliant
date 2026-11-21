import { Banner } from "@/components/banner"

export function MetaBanner({ table }: { table: unknown }) {
  return table ? <Banner /> : null
}
