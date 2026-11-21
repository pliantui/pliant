---
"@pliantui/contract": minor
"@pliantui/core": minor
---

Add the case-insensitive string functions `eqI`, `containsI` and `startsWithI`. Each one lowercases both strings as `lower` does, without locale-specific rules, then compares them as `eq`, `contains` and `startsWith` do. The existing functions stay case-sensitive. The row evaluator in `@pliantui/core` implements the new functions.
