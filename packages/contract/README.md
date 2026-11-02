# @pliantui/contract

Schemas, types and the op catalog for Pliant overlays.

Pliant is in early development. See https://github.com/pliantui/pliant.

## Validating without JavaScript

The package publishes JSON Schemas for overlays, ops, saved views and manifests in `schema/`, plus the op catalog as data in `schema/catalog.json`. Overlays are validated in two steps:

1. Check the overlay against `overlay.json`. It checks the overlay's own fields and that `ops` is a list of 1 to 500 values, but not the ops themselves.
2. Check each op on its own:
   - it matches `op.json`;
   - the overlay's `layer` is in the op's `layers` in `catalog.json`;
   - its `target` is `@app` exactly when the overlay's `surface` is `@app`.

When loading a saved overlay, skip each op that fails and keep the rest. An op whose name isn't in `catalog.json` is from a newer version. So is an op that fails `op.json` but passes once every key other than `op` and `target` that appears in none of its `args` lists is removed. Reject an AI answer or an import if any op fails.
