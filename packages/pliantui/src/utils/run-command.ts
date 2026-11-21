import { spawn } from "node:child_process"

export function formatCommand(command: string, args: string[]) {
  return [command, ...args].join(" ")
}

export function runCommand(command: string, args: string[], cwd: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(
          new Error(
            `${formatCommand(command, args)} exited with code ${String(code)}.`
          )
        )
      }
    })
  })
}
