// Bundlers replace `process.env.NODE_ENV` in client code, as React's own
// development checks rely on.
declare namespace NodeJS {
  interface ProcessEnv {
    readonly NODE_ENV?: string
  }
}
