import {
  functionCatalog,
  type Expression,
  type FunctionDefinition,
  type FunctionName,
} from "@pliantui/contract"

import { productUnit, quotientUnit } from "./combine-units"
import {
  describeTypes,
  fitsTypes,
  literalType,
  unifyTypes,
  type Inferred,
  type ValueType,
} from "./expression-types"

type Param = FunctionDefinition["args"][number]

export type Report = (path: readonly PropertyKey[], message: string) => void

interface Member {
  readonly index: number
  readonly inferred: Inferred
}

interface Group {
  readonly type: ValueType | "null"
  readonly unit: string | undefined
}

interface Call {
  readonly name: FunctionName
  readonly nodes: readonly Expression[]
  /** The inferred argument types, `undefined` where an argument failed. */
  readonly args: readonly (Inferred | undefined)[]
  readonly path: readonly PropertyKey[]
  readonly report: Report
}

const maxArgs = 16

const dateFormats =
  "a date as YYYY-MM-DD or a datetime as ISO 8601 with seconds and an offset"

export function isFunctionName(name: string): name is FunctionName {
  return Object.hasOwn(functionCatalog.functions, name)
}

function plural(count: number) {
  return count === 1 ? "1 argument" : `${String(count)} arguments`
}

function arityText(least: number, most: number, variadic: boolean) {
  if (variadic) {
    return `at least ${plural(least)}`
  }
  if (least === most) {
    return least === 0 ? "no arguments" : plural(least)
  }
  return least === 0
    ? `at most ${plural(most)}`
    : `${String(least)} to ${plural(most)}`
}

function checkArity(
  name: FunctionName,
  params: readonly Param[],
  { length }: readonly Expression[],
  path: readonly PropertyKey[],
  report: Report
) {
  const variadic = params.at(-1)?.variadic === true
  const least = params.filter((param) => param.optional !== true).length
  const most = variadic ? maxArgs : params.length
  if (length >= least && length <= most) {
    return true
  }
  report(
    [...path, "args"],
    length > maxArgs
      ? `${name} takes at most ${plural(maxArgs)}`
      : `${name} takes ${arityText(least, most, variadic)}`
  )
  return false
}

function orList(values: readonly string[]) {
  const quoted = values.map((value) => JSON.stringify(value))
  const last = quoted.pop() ?? ""
  return quoted.length > 0 ? `${quoted.join(", ")} or ${last}` : last
}

function checkConstant(
  { constant, values, range }: Param,
  node: Expression,
  path: readonly PropertyKey[],
  report: Report
) {
  if (constant !== true && values === undefined && range === undefined) {
    return true
  }
  const value = "value" in node ? node.value : undefined
  if (values !== undefined) {
    if (typeof value === "string" && values.includes(value)) {
      return true
    }
    report(path, `Must be ${orList(values)}`)
    return false
  }
  if (!("value" in node)) {
    report(path, "Must be a constant value")
    return false
  }
  if (
    range !== undefined &&
    (typeof value !== "number" || value < range[0] || value > range[1])
  ) {
    report(
      path,
      `Must be a number from ${String(range[0])} to ${String(range[1])}`
    )
    return false
  }
  return true
}

function rootOf(params: readonly Param[], param: Param): Param {
  const { type } = param
  if (typeof type !== "object" || !("like" in type)) {
    return param
  }
  const target = params.find(({ name }) => name === type.like)
  return target ? rootOf(params, target) : param
}

function allowedTypes({ type }: Param): readonly ValueType[] {
  if (typeof type === "string") {
    return [type]
  }
  return "like" in type ? [] : type
}

function groupKey(params: readonly Param[], param: Param, index: number) {
  const root = rootOf(params, param)
  return root === param && param.variadic === true
    ? `${param.name}:${String(index)}`
    : root.name
}

function unifyGroup(
  allowed: readonly ValueType[],
  members: readonly Member[],
  path: readonly PropertyKey[],
  report: Report
): Group | undefined {
  const failed: number[] = []
  let type: ValueType | undefined
  let anchor = 0
  const literals: Member[] = []
  const acceptsDates = allowed.includes("date") || allowed.includes("datetime")
  const fail = (index: number, message: string) => {
    report([...path, "args", index], message)
    failed.push(index)
  }
  for (const member of members) {
    const { index, inferred } = member
    if (inferred.type === "null") {
      continue
    }
    if (inferred.literal !== undefined && allowed.includes("string")) {
      literals.push(member)
      continue
    }
    const own =
      inferred.literal === undefined || !acceptsDates
        ? inferred.type
        : literalType(inferred.literal)
    if (own === undefined) {
      fail(index, `Must be ${dateFormats}`)
      continue
    }
    if (!fitsTypes(own, allowed)) {
      fail(index, `Must be ${describeTypes(allowed)}, not ${own}`)
      continue
    }
    if (type === undefined) {
      type = own
      anchor = index
      continue
    }
    const unified = unifyTypes(type, own)
    if (unified === undefined) {
      fail(
        index,
        `Must be ${describeTypes([type])} to match argument ${String(anchor + 1)}, not ${own}`
      )
      continue
    }
    type = unified
  }
  for (const { index, inferred } of literals) {
    if (type === undefined || type === "string") {
      type = "string"
      continue
    }
    const own = literalType(inferred.literal ?? "")
    const unified = own && unifyTypes(type, own)
    if (unified) {
      type = unified
    } else if (type === "date" || type === "datetime") {
      fail(
        index,
        `Must be ${dateFormats} to match argument ${String(anchor + 1)}`
      )
    } else {
      fail(
        index,
        `Must be ${describeTypes([type])} to match argument ${String(anchor + 1)}, not string`
      )
    }
  }
  let unit: string | undefined
  let unitAnchor = 0
  for (const { index, inferred } of members) {
    if (inferred.unit === undefined) {
      continue
    }
    if (unit === undefined) {
      unit = inferred.unit
      unitAnchor = index
    } else if (inferred.unit !== unit) {
      fail(
        index,
        `Must be in ${unit} to match argument ${String(unitAnchor + 1)}, not ${inferred.unit}`
      )
    }
  }
  return failed.length === 0 ? { type: type ?? "null", unit } : undefined
}

function unitName(unit: string | undefined) {
  return unit ?? "a number without a unit"
}

function joinTypes(types: readonly (ValueType | "null")[]) {
  let joined: ValueType | "null" | undefined = "null"
  for (const type of types) {
    if (joined === undefined || type === "null") {
      continue
    }
    joined = joined === "null" ? type : unifyTypes(joined, type)
  }
  return joined
}

type GroupOf = (argName: string) => Group

function returnType(
  { args, returns }: FunctionDefinition,
  nodes: readonly Expression[],
  groupOf: GroupOf
): ValueType | "null" | undefined {
  if (typeof returns === "string") {
    return returns
  }
  if ("like" in returns) {
    return groupOf(returns.like).type
  }
  if ("join" in returns) {
    return joinTypes(returns.join.map((argName) => groupOf(argName).type))
  }
  const index = args.findIndex(({ name }) => name === returns.integerWhenZero)
  const node = nodes[index]
  const value =
    node === undefined ? args[index]?.default : "value" in node && node.value
  return value === 0 ? "integer" : "number"
}

function unitOf(
  { args, unit }: FunctionDefinition,
  groupOf: GroupOf
): string | undefined | { error: string } {
  if (typeof unit === "object") {
    return groupOf(unit.like).unit
  }
  if (unit !== "product" && unit !== "quotient") {
    return unit === "percent" ? "percent" : undefined
  }
  const [a, b] = args.map(({ name }) => groupOf(name).unit)
  const result = unit === "product" ? productUnit(a, b) : quotientUnit(a, b)
  if (result !== null) {
    return result
  }
  const verb = unit === "product" ? "multiply" : "divide"
  return { error: `Can't ${verb} ${unitName(a)} by ${unitName(b)}` }
}

/**
 * Checks a call of a built-in function against its catalog entry: the number
 * of arguments, constant arguments, argument types and units, and returns the
 * call's type.
 */
export function checkFunctionCall({
  name,
  nodes,
  args,
  path,
  report,
}: Call): Inferred | undefined {
  const definition = functionCatalog.functions[name]
  const params = definition.args
  if (!checkArity(name, params, nodes, path, report)) {
    return undefined
  }
  let valid = true
  const members = new Map<string, { root: Param; members: Member[] }>()
  nodes.forEach((node, index) => {
    const param = params[Math.min(index, params.length - 1)]
    const inferred = args[index]
    if (param === undefined) {
      return
    }
    const constant = checkConstant(
      param,
      node,
      [...path, "args", index],
      report
    )
    if (inferred === undefined || !constant) {
      valid = false
      return
    }
    const key = groupKey(params, param, index)
    const group = members.get(key) ?? {
      root: rootOf(params, param),
      members: [],
    }
    group.members.push({ index, inferred })
    members.set(key, group)
  })
  const groups = new Map<string, Group>()
  for (const [key, group] of members) {
    const unified = unifyGroup(
      allowedTypes(group.root),
      group.members,
      path,
      report
    )
    if (unified) {
      groups.set(key, unified)
    } else {
      valid = false
    }
  }
  if (!valid) {
    return undefined
  }
  const groupOf: GroupOf = (argName) => {
    const param = params.find((candidate) => candidate.name === argName)
    const group = param && groups.get(rootOf(params, param).name)
    return group ?? { type: "null", unit: undefined }
  }

  const type = returnType(definition, nodes, groupOf)
  if (type === undefined) {
    report(path, `The arguments of ${name} must have matching types`)
    return undefined
  }
  const resultUnit = unitOf(definition, groupOf)
  if (typeof resultUnit === "object") {
    report(path, resultUnit.error)
    return undefined
  }
  return (type === "number" || type === "integer") && resultUnit !== undefined
    ? { type, unit: resultUnit }
    : { type }
}
