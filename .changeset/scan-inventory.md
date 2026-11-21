---
"pliantui": minor
---

Add `pliantui scan`. It reads your app's source and writes `lib/pliant/inventory.generated.ts`: for each surface, the ids of its regions, slots, tables and columns, which node holds which and in what order, and the kind of each id with a hash of its kind and manifest. A surface's `baseIds` and `baseParents` go straight into core's `resolveLayers` and `validateOverlay`. A `PliantRoot` in an App Router layout covers the pages under it. Slot ids that start with a digit are rejected, and anything the scan can't read is reported instead of guessed. Run `pliantui scan --check` in CI to fail when the committed inventory is out of date.
