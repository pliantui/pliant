"use client"

import { useSearchContext } from "fumadocs-ui/contexts/search"
import { SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export function SearchButton() {
  const { setOpenSearch } = useSearchContext()

  return (
    <Button
      variant="outline"
      size="lg"
      className="w-full max-w-xs justify-start text-fd-muted-foreground"
      onClick={() => {
        setOpenSearch(true)
      }}
    >
      <SearchIcon />
      Search the docs
    </Button>
  )
}
