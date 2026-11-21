import { spawn } from "node:child_process"

export function formatCommand(command: string, args: string[]) {
  return [command, ...args].join(" ")
}

export function runCommand(command: string, args: string[], cwd: string) {
  return new Promise<void>((resolve, reject) => {
    // On Windows npm, pnpm, yarn and npx are .cmd files, which only run
    // through a shell. The arguments are constants or the --registry value,
    // which init limits to characters a shell treats literally, so joining
    // them into one command string is safe.
    const child =
      process.platform === "win32"
        ? spawn(formatCommand(command, args), {
            cwd,
            stdio: "inherit",
            shell: true,
          })
        : spawn(command, args, { cwd, stdio: "inherit" })
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
