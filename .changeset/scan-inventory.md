---
"pliantui": minor
---

Add `pliantui scan`. It reads your app's source and writes `lib/pliant/inventory.generated.ts`: for each surface, the ids of its regions, slots, tables and columns, which node holds which, and a hash of what each one is. A surface's `baseIds` and `baseParents` go straight into core's `resolveLayers` and `validateOverlay`. Slot ids that start with a digit are rejected, and anything the scan can't read is reported instead of guessed. Run `pliantui scan --check` in CI to fail when the committed inventory is out of date.
