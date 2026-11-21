---
"pliantui": patch
---

Follow the new `@pliantui/react` entry points. `pliantui scan` finds `usePliantRegion` and `useRegionSlots` imported from `@pliantui/react/region`. The page code `pliantui init` prints and the `setup`, `storage` and `tables` skills import `localAdapter` from `@pliantui/react/local` and pass it to `PliantRoot` as `storage`, which is now required.
