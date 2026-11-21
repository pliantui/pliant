---
"@pliantui/contract": patch
"@pliantui/core": patch
"@pliantui/react": patch
---

Order rows whose keys are numbers numerically. Display order, which `first`, `last` and the window functions read, breaks ties and orders an unsorted table by the row key: number keys now come first, in numeric order, so `2` comes before `10`; other keys follow, by code point of their text, as before. `createWindowEvaluator` reads the `id` field's value as it is rather than as text, and its `getRowId` may return a number. `@pliantui/core` exports `compareRowKeys`, the comparison it uses.
