import {
  manifestSchema,
  type Manifest,
  type ManifestDefault,
  type ManifestProp,
} from "@pliantui/contract"

import type { InferredComponent, InferredDefault } from "./inferred-component"

interface BuiltManifest {
  /** Undefined when the component itself can't be described, see `error`. */
  manifest: Manifest | undefined
  error?: string
  /** Props and defaults left out because the contract doesn't accept them. */
  rejected: { name: string; reason: string }[]
  /** Defaults the developer kept that still need values or a range. */
  incomplete: { name: string; needs: "values" | "min and max" }[]
}

function toKind(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
}

function toManifestDefault(item: InferredDefault): ManifestDefault | undefined {
  const persist = item.persist ? { persist: true } : {}
  switch (item.declaration.type) {
    case "boolean":
    case "date":
      return { type: item.declaration.type, ...persist }
    case "number":
      return item.min === undefined || item.max === undefined
        ? undefined
        : { type: "number", min: item.min, max: item.max, ...persist }
    case "enum":
      return { values: item.values ?? item.declaration.values, ...persist }
    case "string":
      return item.values ? { values: item.values, ...persist } : undefined
  }
}

export function buildManifest(component: InferredComponent): BuiltManifest {
  const props: Record<string, ManifestProp> = {}
  for (const prop of component.props) {
    const shown = prop.values.filter(
      (value) => value.class === "user" || value.class === "semantic"
    )
    if (shown.length === 0) {
      continue
    }
    const values = shown.map((value) => value.value)
    const semantic = shown
      .filter((value) => value.class === "semantic")
      .map((value) => value.value)
    props[prop.name] = {
      values,
      ...(prop.default !== undefined && values.includes(prop.default)
        ? { default: prop.default }
        : {}),
      ...(semantic.length > 0 ? { semantic } : {}),
    }
  }

  const defaults: Record<string, ManifestDefault> = {}
  const incomplete: BuiltManifest["incomplete"] = []
  for (const item of component.defaults) {
    if (item.class !== "user") {
      continue
    }
    const declaration = toManifestDefault(item)
    if (declaration) {
      defaults[item.name] = declaration
    } else {
      incomplete.push({
        name: item.name,
        needs: item.declaration.type === "number" ? "min and max" : "values",
      })
    }
  }

  const rejected: BuiltManifest["rejected"] = []
  for (;;) {
    const result = manifestSchema.safeParse({
      kind: toKind(component.name),
      version: 1,
      description: component.description,
      capabilities: {
        ...(Object.keys(props).length > 0 ? { props } : {}),
        ...(Object.keys(defaults).length > 0 ? { defaults } : {}),
        label: true,
        hideable: true,
      },
    })
    if (result.success) {
      return { manifest: result.data, rejected, incomplete }
    }
    const removed = result.error.issues.flatMap((issue) => {
      const [, group, name] = issue.path
      const from =
        group === "props" ? props : group === "defaults" ? defaults : undefined
      if (typeof name !== "string" || !from || !(name in from)) {
        return []
      }
      Reflect.deleteProperty(from, name)
      return [{ name, reason: issue.message }]
    })
    if (removed.length === 0) {
      return {
        manifest: undefined,
        error: result.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
        rejected,
        incomplete,
      }
    }
    rejected.push(...removed)
  }
}
