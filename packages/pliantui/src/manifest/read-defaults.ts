import type { Type } from "ts-morph"

import { getPropsParameter, type Component } from "./component"
import { createDiagnostic, type Diagnostic } from "./diagnostic"
import type { DefaultType, InferredDefault } from "./inferred-component"

function toDefaultType(type: Type): DefaultType | undefined {
  if (type.isBoolean() || type.isBooleanLiteral()) {
    return { type: "boolean" }
  }
  if (type.isString()) {
    return { type: "string" }
  }
  if (type.isNumber()) {
    return { type: "number" }
  }
  if (type.getSymbol()?.getName() === "Date") {
    return { type: "date" }
  }
  const members = type.isUnion() ? type.getUnionTypes() : [type]
  const literals = members.map((member) => member.getLiteralValue())
  const strings = literals.filter((value) => typeof value === "string")
  if (strings.length === members.length) {
    return { type: "enum", values: strings }
  }
  const numbers = literals.filter((value) => typeof value === "number")
  if (numbers.length === members.length) {
    return { type: "enum", values: numbers }
  }
  return undefined
}

export function readDefaults(
  component: Component,
  diagnostics: Diagnostic[]
): InferredDefault[] {
  const parameter = getPropsParameter(component)
  if (!parameter) {
    return []
  }
  const type = parameter.getType()
  if (type.isAny() || type.isUnknown()) {
    return []
  }
  const defaults: InferredDefault[] = []
  for (const property of type.getProperties()) {
    const name = property.getName()
    const match = /^default([A-Z]\w*)$/.exec(name)
    const suffix = match?.[1]
    if (!suffix) {
      continue
    }
    const controlled = suffix.charAt(0).toLowerCase() + suffix.slice(1)
    // React's own DOM attributes, like an input's defaultValue, aren't
    // default state the component declares.
    const isDomAttribute = property
      .getDeclarations()
      .some((declaration) =>
        declaration
          .getSourceFile()
          .getFilePath()
          .includes("/node_modules/@types/react/")
      )
    if (!type.getProperty(controlled) || isDomAttribute) {
      continue
    }
    const propertyType = property.getTypeAtLocation(parameter)
    if (propertyType.isAny() || propertyType.isUnknown()) {
      continue
    }
    const declaration = toDefaultType(propertyType.getNonNullableType())
    if (!declaration) {
      diagnostics.push(
        createDiagnostic(
          component.declaration,
          `${component.name}'s ${name} has a type a default can't hold (${propertyType.getNonNullableType().getText(parameter)}), so it's left out.`
        )
      )
      continue
    }
    defaults.push({ name, declaration, class: "confirm", decided: false })
  }
  return defaults
}
