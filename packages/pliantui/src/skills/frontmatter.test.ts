import { describe, expect, it } from "vitest"

import { parseFrontmatter } from "./frontmatter"

describe("parseFrontmatter", () => {
  it("reads the name and description", () => {
    expect(
      parseFrontmatter(
        "---\nname: setup\ndescription: Does a thing.\n---\n# Hi"
      )
    ).toEqual({ name: "setup", description: "Does a thing." })
  })

  it("reads quoted values and descriptions continued on indented lines", () => {
    expect(
      parseFrontmatter(
        '---\nname: "setup"\ndescription: Does a thing\n  and another: thing.\n---\n'
      )
    ).toEqual({
      name: "setup",
      description: "Does a thing and another: thing.",
    })
  })

  it("rejects a file without frontmatter", () => {
    expect(() => parseFrontmatter("# Hi")).toThrow("no frontmatter")
  })

  it("rejects frontmatter without a description", () => {
    expect(() => parseFrontmatter("---\nname: setup\n---\n")).toThrow(
      "name and a description"
    )
  })
})
