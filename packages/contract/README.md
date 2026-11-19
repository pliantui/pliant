# @pliantui/contract

Schemas, types and the op catalog for Pliant overlays.

Pliant is in early development. See https://github.com/pliantui/pliant.

## Validating without JavaScript

`schema/` holds JSON Schemas for overlays, ops, saved views, stored overlays and manifests, the op catalog as data in `catalog.json`, and the function catalog in `functions.json`. Patterns are ECMA-262 regular expressions: `\d` matches only ASCII digits and `$` matches only at the end of the string (Python's `re` differs on both). `format: date-time` (RFC 3339) must be checked. String lengths count Unicode code points, as `maxLength` does.

`catalog.json` is `{ "contract": 1, "ops": { [name]: { capability, layers, args } } }`. `capability` is checked against manifests at resolution time; `null` means none is needed. `layers` and each `args` list are unordered. `args` holds one list of top-level argument keys per shape, without `op` and `target`. New ops and fields may be added within contract 1, so ignore keys you don't know.

Before anything else, reject an overlay, saved view, stored overlay or manifest if any object in it, at any depth, has a key named `__proto__`, `constructor` or `prototype`. JSON parsers can produce these keys, and some runtimes treat them specially.

To validate an overlay:

1. Check it against `overlay.json`, plus one `explain` sentence per op when `explain` is present.
2. Give each op one status:
   - **invalid** unless it is an object whose `op` matches `^[a-z][A-Za-z0-9]*$` (at most 64 characters) and whose `target` matches `^(?:[a-z][A-Za-z0-9_\-[\]/]*|@[a-z][a-z0-9]*(?:-[a-z0-9]+)*)$` (at most 256);
   - **unknown** if its name isn't in `catalog.json`;
   - **valid** if it matches `op.json`, the overlay's `layer` is in its `layers`, its `target` is `@app` exactly when the overlay's `surface` is `@app`, and it passes the rules below;
   - **newer** if it is valid once every key other than `op` and `target` that appears in none of its `args` lists is removed;
   - **invalid** otherwise.

   Rules JSON Schema can't express: a `move` with `to.into` needs a target that ends in `/slots/<id>` and whose node id doesn't end in `[]`, and `to.into` can't be the target or start with the target followed by `/`; the `field`s in a value matching `op.json`'s `#/$defs/sort` are unique; a value matching `#/$defs/expression` has at most 128 nodes.

A `remove` targets a slot address outside a template or the bare id of a node. Whether a bare id names a node the user inserted or wrapped is checked at resolution time, not during validation.

When loading a saved overlay, apply only valid ops, flag unknown and newer ones, and keep every op unchanged when saving it again. Reject an AI answer or an import unless every op is valid.

A saved view also needs every overlay to have the view's `surface` and `layer`, the same `scope.org` and `scope.team` as the others, and a unique `id`. In a manifest, a prop's `default` and `semantic` values must be among its `values`.

## Stored overlays

A storage adapter stores and returns each overlay as a record that `stored-overlay.json` and `storedOverlaySchema` describe: `{ overlay, etag, version, updatedAt }`.

- `overlay` is checked as a saved overlay: the record is valid even when some ops are unknown, newer or invalid, and the adapter keeps every op and unknown field unchanged.
- `etag` is an opaque string of 1 to 256 characters. The adapter changes it on every save, and clients only compare it for equality.
- `version` is an integer from 1. It is the version `basis.layers` records, and clients compare versions to tell that a layer changed.
- `updatedAt` is an RFC 3339 date-time with an offset, like `createdAt`.

The adapter methods and the `conflict` result of a conditional save belong to `@pliantui/react`, not to the contract.

## Function catalog

`functions.json` is `{ "contract": 1, "rules": [...], "functions": { [name]: { kind, args, returns, unit, nulls, mergeable, describe } } }`, and `functionCatalog` holds the same `rules` and `functions`. The `rules` hold for every function. Names and documented semantics don't change within contract 1: a different behaviour gets a new name, and the only exception is a fix where a function's output contradicted its documented semantics. New functions and fields may be added, so ignore keys you don't know.

- `kind` is `row`, `aggregate` or `window`.
- Each `args` entry has a `name` and a `type`. It may be `optional` (only trailing arguments, with the `default` it takes when left out, if any), `variadic` (only the last argument; one or more values), `constant` (a `{ value }` node, within `range` when given), or list `values` (a `{ value }` node holding one of those strings).
- A `type` is `number`, `integer`, `string`, `boolean`, `date` or `datetime`, a list of those, or `{ "like": "<argument>" }`, which joins an earlier argument's group. Integer fields are `integer`; number, currency and percent fields are `number`; string, text, enum, id, url and email fields are `string`.
- `returns` is a type, `{ "like": "<argument>" }` for the type of that argument's group, `{ "join": [...] }` for the unified type of separate number arguments (integer only when all of them are), or `{ "integerWhenZero": "<argument>" }` for `integer` when that constant is 0 and `number` otherwise.
- `unit` is the unit of a number result: `none`, `percent`, `{ "like": "<argument>" }`, or the `product` and `quotient` rules in `rules`. It decides a derived value's unit; decimals and date styles are inherited as `addDerived` describes.
- `nulls` is `propagate` (a null argument makes the result null), `skip` (null values are left out, and window functions give their rows null) or `custom` (as `describe` says).
- `mergeable` lists the summary an aggregate merges from, or is `null`. `count` and `sum` add, `min` and `max` keep the extreme, and `mean` and `m2` merge with `count` by Chan's parallel algorithm. Whether a value covers all rows or only loaded ones also depends on the mode and the server adapter.

A SQL translation must give the same results as `rules` and `describe` say, even where the dialect's own functions differ. Where the database raises an error on floating-point overflow instead of returning an infinity, the translation must guard against it or not compile the function.

The `in` function takes at most 15 values, because a function takes at most 16 arguments. The 100-value limit is for the `in` filter operator.
