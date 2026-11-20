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
  looksLikeDate,
  unifyTypes,
  type Inferred,
  type ValueType,
} from "./expression-types"

type Param = FunctionDefinition["args"][number]

export type Report = (path: readonly PropertyKey[], message: string) => void

interface Member {
  readonly index: number
  /** The name of the argument in the catalog. */
  readonly name: string
  readonly inferred: Inferred
}

interface Group {
  readonly allowed: readonly ValueType[]
  /** Whether other arguments are `like` this one. */
  readonly joined: boolean
  readonly members: Member[]
}

interface Unified {
  readonly type: ValueType
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

function dateLiteralMessage(text: string, suffix: string) {
  return looksLikeDate(text)
    ? `${JSON.stringify(text)} isn't a valid date`
    : `Must be ${dateFormats}${suffix}`
}

/**
 * Unifies the arguments of one group: an argument on its own, or arguments
 * joined by `like`. A null literal fits only a `like` group with a typed
 * member, whose type it takes.
 */
function unifyGroup(
  { allowed, joined, members }: Group,
  path: readonly PropertyKey[],
  report: Report
): Unified | undefined {
  const failed: number[] = []
  let type: ValueType | undefined
  let anchor = ""
  const literals: Member[] = []
  const nulls: Member[] = []
  const acceptsDates = allowed.includes("date") || allowed.includes("datetime")
  const fail = (index: number, message: string) => {
    report([...path, "args", index], message)
    failed.push(index)
  }
  for (const member of members) {
    const { index, name, inferred } = member
    if (inferred.type === "null") {
      nulls.push(member)
      continue
    }
    if (inferred.literal !== undefined && allowed.includes("string")) {
      literals.push(member)
      continue
    }
    let own = inferred.type
    if (inferred.literal !== undefined && acceptsDates) {
      const read = literalType(inferred.literal)
      if (read === undefined) {
        fail(index, dateLiteralMessage(inferred.literal, ""))
        continue
      }
      own = read
    }
    if (!fitsTypes(own, allowed)) {
      fail(index, `Must be ${describeTypes(allowed)}, not ${own}`)
      continue
    }
    if (type === undefined) {
      type = own
      anchor = name
      continue
    }
    const unified = unifyTypes(type, own)
    if (unified === undefined) {
      fail(
        index,
        `Must be ${describeTypes([type])} to match \`${anchor}\`, not ${own}`
      )
      continue
    }
    type = unified
  }
  for (const { index, inferred } of literals) {
    const literal = inferred.literal ?? ""
    if (type === undefined || type === "string") {
      type = "string"
      continue
    }
    const own = literalType(literal)
    const unified = own && unifyTypes(type, own)
    if (unified) {
      type = unified
    } else if (type === "date" || type === "datetime") {
      fail(index, dateLiteralMessage(literal, ` to match \`${anchor}\``))
    } else {
      fail(
        index,
        `Must be ${describeTypes([type])} to match \`${anchor}\`, not string`
      )
    }
  }
  if (!joined || type === undefined) {
    for (const { index } of nulls) {
      fail(index, `Must be ${describeTypes(allowed)}, not null`)
    }
  }
  let unit: string | undefined
  let unitAnchor = ""
  for (const { index, name, inferred } of members) {
    if (inferred.unit === undefined) {
      continue
    }
    if (unit === undefined) {
      unit = inferred.unit
      unitAnchor = name
    } else if (inferred.unit !== unit) {
      fail(
        index,
        `Must be in ${unit} to match \`${unitAnchor}\`, not ${inferred.unit}`
      )
    }
  }
  return failed.length === 0 && type !== undefined ? { type, unit } : undefined
}

function unitName(unit: string | undefined) {
  return unit ?? "a number without a unit"
}

function joinTypes([first, ...rest]: readonly (ValueType | undefined)[]) {
  return rest.reduce<ValueType | undefined>(
    (joined, type) => joined && type && unifyTypes(joined, type),
    first
  )
}

type GroupOf = (argName: string) => Unified | undefined

function returnType(
  { args, returns }: FunctionDefinition,
  nodes: readonly Expression[],
  groupOf: GroupOf
): ValueType | undefined {
  if (typeof returns === "string") {
    return returns
  }
  if ("like" in returns) {
    return groupOf(returns.like)?.type
  }
  if ("join" in returns) {
    return joinTypes(returns.join.map((argName) => groupOf(argName)?.type))
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
    return groupOf(unit.like)?.unit
  }
  if (unit !== "product" && unit !== "quotient") {
    return unit === "percent" ? "percent" : undefined
  }
  const [a, b] = args.map(({ name }) => groupOf(name)?.unit)
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
 * call's type with the type each argument is read as.
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
  const joined = new Set(
    params.flatMap((param) =>
      rootOf(params, param) === param ? [] : [rootOf(params, param).name]
    )
  )
  const groups = new Map<string, Group>()
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
    const root = rootOf(params, param)
    const key = groupKey(params, param, index)
    const group = groups.get(key) ?? {
      allowed: allowedTypes(root),
      joined: joined.has(root.name),
      members: [],
    }
    group.members.push({ index, name: param.name, inferred })
    groups.set(key, group)
  })
  const unified = new Map<string, Unified>()
  for (const [key, group] of groups) {
    const result = unifyGroup(group, path, report)
    if (result) {
      unified.set(key, result)
    } else {
      valid = false
    }
  }
  if (!valid) {
    return undefined
  }
  const groupOf: GroupOf = (argName) => {
    const param = params.find((candidate) => candidate.name === argName)
    return param && unified.get(rootOf(params, param).name)
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
  const reads = nodes.map((_, index) => {
    const param = params[Math.min(index, params.length - 1)]
    return param && unified.get(groupKey(params, param, index))?.type
  })
  return (type === "number" || type === "integer") && resultUnit !== undefined
    ? { type, unit: resultUnit, reads }
    : { type, reads }
}
