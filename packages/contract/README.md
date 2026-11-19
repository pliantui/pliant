# @pliantui/contract

Schemas, types and the op catalog for Pliant overlays.

Pliant is in early development. See https://github.com/pliantui/pliant.

## Validating without JavaScript

`schema/` holds JSON Schemas for overlays, ops, saved views and manifests, the op catalog as data in `catalog.json`, and the function catalog in `functions.json`. Patterns are ECMA-262 regular expressions: `\d` matches only ASCII digits and `$` matches only at the end of the string (Python's `re` differs on both). `format: date-time` (RFC 3339) must be checked. String lengths count Unicode code points, as `maxLength` does.

`catalog.json` is `{ "contract": 1, "ops": { [name]: { capability, layers, args } } }`. `capability` is checked against manifests at resolution time; `null` means none is needed. `layers` and each `args` list are unordered. `args` holds one list of top-level argument keys per shape, without `op` and `target`. New ops and fields may be added within contract 1, so ignore keys you don't know.

Before anything else, reject an overlay, saved view or manifest if any object in it, at any depth, has a key named `__proto__`, `constructor` or `prototype`. JSON parsers can produce these keys, and some runtimes treat them specially.

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

## Function catalog

`functions.json` is `{ "contract": 1, "functions": { [name]: { kind, args, returns, nulls, mergeable, sql, describe } } }`. Names and documented semantics never change within contract 1; a different behaviour gets a new name. New functions and fields may be added, so ignore keys you don't know.

- `kind` is `row`, `aggregate` or `window`. Aggregate and window arguments are row expressions. A window function's partition is the row's group when the table is grouped, otherwise every row after filters.
- Each `args` entry has a `name` and a `type`, and may be `optional` (only trailing arguments), `variadic` (only the last argument; one or more values), `constant` (a `{ value }` node) or list `values` (a `{ value }` node holding one of those strings).
- A `type` is `number`, `string`, `boolean`, `date` or `datetime`, a list of those, or `{ "like": "<argument>" }` for the type of an earlier argument. `returns` is a type or a `like`. Number, integer, currency and percent fields are `number`; string, text, enum, id, url and email fields are `string`.
- `nulls` is `propagate` (a null argument makes the result null), `skip` (null values are left out, and window functions give their rows null) or `custom` (as `describe` says). NaN counts as null, and a result that would be NaN or infinite is null.
- `mergeable` lists the summary an aggregate merges from, or is `null`. `count` and `sum` add, `min` and `max` keep the extreme, and `mean` and `m2` merge with `count` by Chan's parallel algorithm.
- `sql` says whether server adapters compile the function to SQL. In server mode, an aggregate that isn't mergeable or a function without SQL covers loaded rows only.
- Dates are read in the dataset's time zone.
