# @pliantui/contract

Schemas, types and the op catalog for Pliant overlays.

Pliant is in early development. See https://github.com/pliantui/pliant.

## Validating without JavaScript

`schema/` holds JSON Schemas for overlays, ops, saved views, stored overlays and manifests, the op catalog as data in `catalog.json`, and the function catalog in `functions.json`. Patterns are ECMA-262 regular expressions: `\d` matches only ASCII digits and `$` matches only at the end of the string (Python's `re` differs on both). `format: date-time` (RFC 3339) must be checked. String lengths count Unicode code points, as `maxLength` does.

`catalog.json` is `{ "contract": 1, "ops": { [name]: { capability, layers, args } } }`. `args` holds one list of top-level argument keys per shape, without `op` and `target`, ordered from narrowest to widest. `capability` is a list with one entry per `args` list: `capability[i]` names the capability that the manifest of the node the op applies to must have for the shape `args[i]`, and `null` means none is needed. Most ops have a single shape and a single-entry list. An op takes the `capability` entry of the first `args` list that contains every argument key it has. `setDefault` is the only op whose shapes need different capabilities: without `prop` it takes `["value"]`, and the field's parent node must have `form`; with `prop` it takes `["prop", "value"]`, and the target must have `defaults`. `layers` and the keys inside each `args` list are unordered. New ops and fields may be added within contract 1, so ignore keys you don't know.

Before anything else, reject an overlay, saved view, stored overlay or manifest if any object in it, at any depth, has a key named `__proto__`, `constructor` or `prototype`. JSON parsers can produce these keys, and some runtimes treat them specially.

To validate an overlay:

1. Check it against `overlay.json`, plus one `explain` sentence per op when `explain` is present.
2. Give each op one status:
   - **invalid** unless it is an object whose `op` matches `^(?:[a-z][a-z0-9]*(?:-[a-z0-9]+)*:)?[a-z][A-Za-z0-9]*$` and doesn't start with `pliant:` (at most 64 characters) and whose `target` matches `^(?:[a-z][A-Za-z0-9_\-[\]/]*|@[a-z][a-z0-9]*(?:-[a-z0-9]+)*)$` (at most 256);
   - **unknown** if its name isn't in `catalog.json`;
   - **valid** if it matches `op.json`, the overlay's `layer` is in its `layers`, its `target` is `@app` exactly when the overlay's `surface` is `@app`, and it passes the rules below;
   - **newer** if it is valid once every key other than `op` and `target` that appears in none of its `args` lists is removed;
   - **invalid** otherwise.

   Rules JSON Schema can't express: a `move` with `to.into` needs a target that ends in `/slots/<id>` and whose node id doesn't end in `[]`, and `to.into` can't be the target or start with the target followed by `/`; the `field`s in a value matching `op.json`'s `#/$defs/sort` are unique; a value matching `#/$defs/expression` has at most 128 nodes.

   Rules `op.json` doesn't carry: a `setDefault` without `prop` targets an address ending in `/fields/<id>`. A `setDefault` with `prop` targets a node address only: no `/columns/`, `/fields/`, `/items/` or `/actions/` segment, and never a reserved target such as `@app` or `@surface`. Its `value` is a string of 1 to 64 characters, a number or a boolean.

An `insert` adds a node of a built-in kind, `chart`, `stat` or `list`, which needs a `dataset`, or of a kind an application registers as `namespace:name`, which may name one. Any other bare kind is invalid. The `dataset` must be one the surface already shows. The schemas and `validateOverlay` don't know which datasets those are, so whatever applies ops with the surface's datasets at hand must check it and treat an `insert` over any other dataset as invalid.

A `remove` targets a slot address outside a template or the bare id of a node. Whether a bare id names a node the user inserted or wrapped is checked at resolution time, not during validation.

A `setPresentation` with `as: "sheet"` or `as: "drawer"` may set `side` to `top`, `bottom`, `start` or `end`. `start` and `end` follow the writing direction, so in a right-to-left document `start` is the right edge. A renderer maps them to a physical side using the resolved direction.

A reserved per-row address is a kebab-case node id, then `[`, one or more characters from `[A-Za-z0-9_-]`, then `]`, then `/` or the end of the address, for example `order-card[42]` or `order-card[42]/actions/refund`. That is, it matches `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\[[A-Za-z0-9_-]+\](?:/|$)`. It isn't valid, and the patterns in `schema/` don't match it. `order-card[]` addresses every row of a template. The Zod address and op schemas report a reserved address, whatever the rest of the address, with a custom issue whose `params.code` is `per-row-address-reserved`, in place of a format issue. It's always the first issue; on older Zod 4 releases, an address over the length limit also gets a length issue after it. An op with such a target is invalid.

An overlay's optional `lang` is the BCP 47 language tag of its plain label strings. It must match `#/$defs/languageTag`: RFC 5646's `langtag` form, without grandfathered or private-use-only tags, in at most 64 characters. Zod checks the same pattern and length limit and nothing more, so the pattern is authoritative: the tag needn't be registered or canonical, and `Intl.getCanonicalLocales`, which is stricter (it rejects a repeated variant, for example), isn't used.

When loading a saved overlay, apply only valid ops, flag unknown and newer ones, and keep every op unchanged when saving it again. An unknown op with a namespaced name needs an extension that isn't installed, which updating Pliant won't fix, so skip it without flagging it. Reject an AI answer or an import unless every op is valid.

`validateOverlay` in `@pliantui/core` makes the checks above and doesn't read manifests. The following rules need manifests, so whatever applies ops with the manifests at hand must check them:

- The node the op applies to has the `capability` entry for the op's shape, as `catalog.json` describes.
- A `setDefault` with `prop` names a prop declared in the target's `defaults`, and its `value` fits that declaration:
  - for `values`, it is one of them, so a string when the values are strings and a number when they are numbers;
  - for `type: "boolean"`, it is a boolean;
  - for `type: "number"`, it is a number from `min` to `max`;
  - for `type: "date"`, it is a real calendar date written `YYYY-MM-DD` (`2026-02-30` doesn't fit).

These values are never data values. With `persist: true`, the user's own changes to that prop are saved to their personal layer automatically. A field's default, set by `setDefault` without `prop`, is a data value and must parse with the field's schema.

A saved view also needs every overlay to have the view's `surface` and `layer`, the same `scope.org` and `scope.team` as the others, and a unique `id`. In a manifest, a prop's `default` and `semantic` values must be among its `values`. A `defaults` declaration of `type: "number"` needs `min` at most `max`.

## Namespaced ops and capabilities

Bare op names and the `pliant:` namespace belong to built-in ops. An op named `namespace:name`, with a kebab-case namespace and a camelCase name such as `crm:markMine`, belongs to an extension. It writes a single property on its target, `ext.<namespace>.<name>`, whose value is its arguments, and it can't write any other property. No built-in op writes a property that starts with `ext.`. `catalog.json` lists only built-in ops, so a validator that reads it treats every namespaced op as unknown.

A manifest's `capabilities` may hold namespaced keys, such as `"crm:starrable"`, with any JSON value. A namespaced key is a kebab-case `namespace:name` of at most 64 characters, outside the `pliant:` namespace. Keep them and otherwise ignore them. Every other key must be one of the built-in capabilities, so a typo like `hidable` is an error.

## Stored overlays

A storage adapter stores and returns each overlay as a record that `stored-overlay.json` and `storedOverlaySchema` describe: `{ overlay, etag, version, updatedAt }`.

- `overlay` is checked as a saved overlay: the record is valid even when some ops are unknown, newer or invalid, and the adapter keeps every op and unknown field unchanged.
- `etag` is an opaque string of 1 to 256 characters. Every successful save gives the overlay an etag it has never had before. Clients only compare etags for equality.
- `version` is an integer from 1. The adapter increases it on every save. For a team or org overlay it is the version that `basis.layers` records, and clients compare versions to tell that a layer changed.
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

`functionSignatures` holds each function's `kind`, `args`, `returns`, `unit`, `nulls` and `mergeable`, the same values as in `functionCatalog`, without `describe`. Code that type-checks or evaluates expressions can import it instead of `functionCatalog` to leave the descriptions and rules out of its bundle.

A SQL translation must give the same results as `rules` and `describe` say, even where the dialect's own functions differ. Where the database raises an error on floating-point overflow instead of returning an infinity, the translation must guard against it or not compile the function.

The `in` function takes at most 15 values, because a function takes at most 16 arguments. The 100-value limit is for the `in` filter operator.

## Flags

`flagsSchema` checks the flags set on one address in `pliant.config.ts`:

```ts
flags: { "/settings": { "settings-actions/slots/save": { primary: true } } }
```

`primary` marks the primary action of its action group: a `PliantActions` node, a form or a dialog. Each group has at most one, so a page with several forms or dialogs can have several. It is set by address, never derived from position, because a user's reorder would change it. `flagsSchema` validates one address at a time, so it doesn't check that a group has only one.
