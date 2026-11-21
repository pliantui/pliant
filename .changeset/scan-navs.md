---
"pliantui": patch
---

`pliantui scan` finds navs: a call to `usePliantNav` from `@pliantui/react/nav`, such as the one `PliantNav` makes, is a nav, and each key of its items object is listed as an item address like `app-sidebar/items/reports`. Item ids that start with a digit are rejected, and ids overlays can't address are reported and left out. An object passed to one of Pliant's own hooks is no longer treated as one the hook may fill, so its other uses don't mark the surface as not read in full.
