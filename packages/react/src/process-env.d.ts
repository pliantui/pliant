// Bundlers replace `process.env.NODE_ENV` only when it's written with dots.
declare namespace NodeJS {
  interface ProcessEnv {
    readonly NODE_ENV?: string
  }
}
