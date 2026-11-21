---
"pliantui": patch
---

`pliantui scan` finds forms: a call to `usePliantForm` from `@pliantui/react/form`, such as the one `PliantForm` makes, is a form, and each key of its fields object is listed as a field address like `ticket-form/fields/priority`. Field names that start with a digit are rejected, and names overlays can't address are reported and left out.
