# @pliantui/contract

Schemas, types and the op catalog for Pliant overlays.

Pliant is in early development. See https://github.com/pliantui/pliant.

## Validating without JavaScript

`schema/` holds JSON Schemas for overlays, ops, saved views and manifests, and the op catalog as data in `catalog.json`. Patterns are ECMA-262 regular expressions: `\d` matches only ASCII digits and `$` matches only at the end of the string (Python's `re` differs on both). `format: date-time` (RFC 3339) must be checked. String lengths count Unicode code points, as `maxLength` does.

`catalog.json` is `{ "contract": 1, "ops": { [name]: { capability, layers, args } } }`. `capability` is checked against manifests at resolution time; `null` means none is needed. `layers` and each `args` list are unordered. `args` holds one list of top-level argument keys per shape, without `op` and `target`. New ops and fields may be added within contract 1, so ignore keys you don't know.

To validate an overlay:

1. Check it against `overlay.json`, plus one `explain` sentence per op when `explain` is present.
2. Give each op one status:
   - **invalid** unless it is an object whose `op` matches `^[a-z][A-Za-z0-9]*$` (at most 64 characters) and whose `target` matches `^(?:[a-z][A-Za-z0-9_\-[\]/]*|@[a-z][a-z0-9]*(?:-[a-z0-9]+)*)$` (at most 256);
   - **unknown** if its name isn't in `catalog.json`;
   - **valid** if it matches `op.json`, the overlay's `layer` is in its `layers`, its `target` is `@app` exactly when the overlay's `surface` is `@app`, and it passes the rules below;
   - **newer** if it is valid once every key other than `op` and `target` that appears in none of its `args` lists is removed;
   - **invalid** otherwise.

   Rules JSON Schema can't express: a `move` with `to.into` needs a target that ends in `/slots/<id>` and whose node id doesn't end in `[]`, and `to.into` can't be the target or start with the target followed by `/`; the `field`s in a value matching `op.json`'s `#/$defs/sort` are unique; a value matching `#/$defs/expression` has at most 128 nodes.

When loading a saved overlay, apply only valid ops, flag unknown and newer ones, and keep every op unchanged when saving it again. Reject an AI answer or an import unless every op is valid.

A saved view also needs every overlay to have the view's `surface` and `layer`, the same `scope.org` and `scope.team` as the others, and a unique `id`. In a manifest, a prop's `default` and `semantic` values must be among its `values`.
