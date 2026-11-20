import { describe, expect, it } from "vitest"

import { readFixture } from "../test/fixtures"
import { expectCrossFieldIssue } from "../test/fixtures/cross-field"
import { capabilitySchema } from "./capability"
import { defineManifest, manifestSchema } from "./manifest"

const fixture = readFixture("manifest")

describe("manifestSchema", () => {
  it("declares exactly the capabilities in the capability set", () => {
    expect(Object.keys(manifestSchema.out.shape.capabilities.shape)).toEqual(
      capabilitySchema.options
    )
  })

  it.each(fixture.valid)("accepts %j", (manifest) => {
    expect(manifestSchema.safeParse(manifest).success).toBe(true)
  })

  it.each(fixture.invalid)("rejects %j", (manifest) => {
    expect(manifestSchema.safeParse(manifest).success).toBe(false)
  })

  it.each(fixture.crossField)("reports $message for $value", (entry) => {
    expectCrossFieldIssue(manifestSchema, entry)
  })

  it("keeps namespaced capabilities and their values", () => {
    const capabilities = {
      label: true,
      "crm:starrable": { icon: "star", levels: [1, 2, 3] },
    }
    expect(
      manifestSchema.parse({
        kind: "button",
        version: 1,
        description: "Clickable action",
        capabilities,
      }).capabilities
    ).toEqual(capabilities)
  })

  it("reports a misspelled capability as an unrecognized key", () => {
    const result = manifestSchema.safeParse({
      kind: "button",
      version: 1,
      description: "Clickable action",
      capabilities: { hidable: true, label: "yes", "crm:starrable": true },
    })
    expect(
      result.error?.issues.map(({ code, path }) => [code, path.join(".")])
    ).toEqual([
      ["invalid_type", "capabilities.label"],
      ["unrecognized_keys", "capabilities"],
    ])
    expect(result.error?.issues[1]).toMatchObject({ keys: ["hidable"] })
  })

  it("reports only the format issue for a malformed namespaced kind", () => {
    const result = manifestSchema.safeParse({
      kind: "pliant:Button",
      version: 1,
      description: "Clickable action",
      capabilities: {},
    })
    expect(result.error?.issues.map(({ message }) => message)).toEqual([
      "Must be kebab-case, optionally namespaced, for example acme:rating",
    ])
  })
})

describe("defineManifest", () => {
  it("returns the parsed manifest", () => {
    expect(
      defineManifest({
        kind: "badge",
        version: 1,
        description: "Status label",
        capabilities: { label: true },
      })
    ).toEqual({
      kind: "badge",
      version: 1,
      description: "Status label",
      capabilities: { label: true },
    })
  })

  it("throws on an invalid manifest", () => {
    expect(() =>
      defineManifest({
        kind: "Badge",
        version: 1,
        description: "Status label",
        capabilities: {},
      })
    ).toThrow("kebab-case")
  })
})
