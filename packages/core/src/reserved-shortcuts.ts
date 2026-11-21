type Platform = "pc" | "mac"

const platforms: readonly Platform[] = ["pc", "mac"]

const modifierOrder = ["ctrl", "alt", "shift", "meta"]

const arrows = "arrowleft arrowright arrowup arrowdown"

/**
 * Keys a user binding never takes, by modifiers in `bindShortcut`'s form,
 * where `mod` is Ctrl on Windows and Linux and Command on macOS. `*` stands
 * for every key.
 */
const reserved: Readonly<Record<Platform | "any", Record<string, string>>> = {
  any: {
    // Without a modifier, or with Shift alone, keys type text, move focus and
    // drive a screen reader's browse mode.
    "": "*",
    shift: "*",
    // Alt types characters on macOS and opens the browser's menus elsewhere.
    alt: "*",
    "alt+shift": "*",
    // Ctrl+Alt is AltGr on Windows, which types characters, and holds the
    // VoiceOver keys on macOS.
    "ctrl+alt": "*",
    "ctrl+alt+shift": "*",
    // Tabs, windows, the address bar, reloading, history, downloads,
    // bookmarks, find, printing, the page source, zoom and text editing.
    mod: `a c d f g h j l n p q r t u v w x y z 0 1 2 3 4 5 6 7 8 9 = - [ ] tab space home end backspace delete ${arrows}`,
    "mod+shift": `b g n o r t w z = tab home end ${arrows}`,
    ctrl: "tab",
    "ctrl+shift": "tab",
  },
  pc: {
    // Switching and closing tabs, the Start menu, developer tools, clearing
    // browsing data and the Task Manager.
    ctrl: "pageup pagedown f4",
    mod: "escape",
    "mod+shift": "c i j delete escape",
  },
  mac: {
    // Minimizing, settings, switching windows, turning VoiceOver on and off,
    // Spaces and input sources.
    mod: "m , ` f5",
    ctrl: `space ${arrows}`,
    // Screenshots, logging out and switching tabs.
    "mod+shift": "3 4 5 q [ ]",
    // Developer tools, the Dock and Force Quit.
    "mod+alt": "c d i j escape",
  },
}

/** The modifiers and key `keys` presses on `platform`. */
function press(keys: string, platform: Platform) {
  const parts = keys.split("+")
  const key = parts.pop() ?? ""
  const held = new Set(
    parts.map((part) =>
      part === "mod" ? (platform === "mac" ? "meta" : "ctrl") : part
    )
  )
  return {
    modifiers: modifierOrder.filter((name) => held.has(name)).join("+"),
    key,
  }
}

/** Whether two bindings press the same keys on Windows, Linux or macOS. */
export function sameShortcut(a: string, b: string) {
  return platforms.some((platform) => {
    const first = press(a, platform)
    const second = press(b, platform)
    return first.modifiers === second.modifiers && first.key === second.key
  })
}

/**
 * Whether a binding takes keys that belong to the browser, the system or
 * assistive technology on Windows, Linux or macOS. On Windows and Linux,
 * Meta is the Windows or Super key, which the system owns, so `meta` is for
 * no binding there.
 */
export function isReservedShortcut(keys: string) {
  return platforms.some((platform) => {
    const { modifiers, key } = press(keys, platform)
    if (platform === "pc" && modifiers.includes("meta")) {
      return true
    }
    return [reserved.any, reserved[platform]].some((table) =>
      Object.entries(table).some(
        ([held, list]) =>
          press(held ? `${held}+${key}` : key, platform).modifiers ===
            modifiers &&
          (list === "*" || list.split(" ").includes(key))
      )
    )
  })
}
