// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"

import { File, FileTree, Folder } from "@/components/file-tree"

afterEach(cleanup)

it("shows a folder's files and hides them when the folder is closed", () => {
  render(
    <FileTree>
      <Folder name="app">
        <File name="page.tsx" />
      </Folder>
      <File name="package.json" />
    </FileTree>
  )
  const folder = screen.getByRole("button", { name: "app" })

  expect(folder.getAttribute("aria-expanded")).toBe("true")
  expect(screen.queryByText("page.tsx")).not.toBeNull()

  fireEvent.click(folder)

  expect(folder.getAttribute("aria-expanded")).toBe("false")
  expect(screen.queryByText("page.tsx")).toBeNull()
  expect(screen.queryByText("package.json")).not.toBeNull()
})

it("starts a folder closed when asked", () => {
  render(
    <FileTree>
      <Folder name="components" defaultOpen={false}>
        <File name="button.tsx" />
      </Folder>
    </FileTree>
  )

  expect(screen.queryByText("button.tsx")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "components" }))
  expect(screen.queryByText("button.tsx")).not.toBeNull()
})
