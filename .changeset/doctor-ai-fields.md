---
"pliantui": minor
---

Add an `ai-fields` check to `pliantui doctor`. It finds each `defineDataset` from `@pliantui/server/data` and lists the fields the AI is told about, with their types, and the ones that set `exposeToAI: false`. It warns when a visible field looks sensitive, like an email, phone number, address, salary, password or token, and when a field can't be read without running your code. Its warnings don't change the exit code, and `--json` includes every field in the check's `details`.
