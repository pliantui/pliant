---
"pliantui": minor
---

Add `pliantui manifest`. It reads the `cva` and `tailwind-variants` definitions in your ui folder and generates a manifest for each component. A review step lets you check the result first; skip it with `--yes`. Kinds are namespaced (`app:button` by default; set your own with `--namespace`).
