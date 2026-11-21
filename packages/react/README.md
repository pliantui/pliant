# @pliantui/react

React bindings for Pliant: the provider, the layer store and hooks.

Each feature has its own entry point, so a page loads only what it uses:

| Entry                            | Exports                                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `@pliantui/react`                | `PliantRoot`, the store, status, preview, surface and node hooks, `usePliantMessages` and `StorageConflictError` |
| `@pliantui/react/region`         | `usePliantRegion`, `useRegionSlots`, `useRegionItems`, `useSlotContent`, `PliantActivity`                        |
| `@pliantui/react/form`           | `usePliantForm`, `usePliantFormDefaults`                                                                         |
| `@pliantui/react/table`          | `usePliantTable`                                                                                                 |
| `@pliantui/react/local`          | `localAdapter`, which stores personal overlays in the browser                                                    |
| `@pliantui/react/server-adapter` | `serverAdapter`, which stores overlays through your server                                                       |
| `@pliantui/react/ask`            | `useAskPanel`                                                                                                    |
| `@pliantui/react/point-mode`     | `usePointMode`                                                                                                   |
| `@pliantui/react/pre-paint`      | `PliantPrePaint`                                                                                                 |

Pliant is in early development. See https://github.com/pliantui/pliant.
