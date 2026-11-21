---
"@pliantui/react": patch
---

Add `resetNode` to the store from `usePliantStore()`. It drops the user's own changes to a node, the ops in their personal and session layers that write its properties or those of its items, such as a table's sort, filters and column widths, so the node shows as the org and team layers have it. Personal versions with such ops are removed from storage with the adapter's `remove`, and their other ops are saved again in the same order. It returns a `ResetNodeResult`, and is rejected when the adapter has no `remove`.
