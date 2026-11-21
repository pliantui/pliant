---
"@pliantui/react": patch
---

A closed collapse from `useRegionItems` now opens and takes focus only when a form submit finds a control inside invalid. A control that becomes invalid while the user types elsewhere, as with validation on change, no longer opens the collapse or moves focus, and a collapse the user closed stays closed until a submit finds another control inside invalid.
