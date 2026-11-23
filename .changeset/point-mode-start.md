---
"@pliantui/react": minor
---

`usePointMode` no longer turns point mode on or off with ⌘. or Ctrl+., so apps can use that shortcut to ask about the focused part. It returns `start`, which turns point mode on as a dialog (and keeps it on after Alt is released when called during a hold), and `exit`, which turns it off. `onPick` is now optional, for apps that keep point mode on and act on the picked target themselves.
