---
"@pliantui/react": patch
---

`localAdapter().history` now orders records saved in the same millisecond by version, then by overlay id, instead of by storage key.
