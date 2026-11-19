// Bundlers replace `process.env.NODE_ENV`; where none did and there is no
// `process`, this is a browser build that isn't development.
function readIsDevelopment() {
  try {
    return process.env.NODE_ENV !== "production"
  } catch {
    return false
  }
}

export const isDevelopment = readIsDevelopment()
