---
"@pliantui/react": patch
---

Add `resetNode(target)` to the store from `usePliantStore()`. It drops the user's own changes to a node, such as a table's sort, filters and column widths, so the node shows as the team and org defaults have it. It needs a storage adapter with `remove`; without one, the reset is rejected and reported to `PliantRoot`'s `onError`.
