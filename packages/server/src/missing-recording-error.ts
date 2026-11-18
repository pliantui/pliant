export class MissingRecordingError extends Error {
  constructor(key: string) {
    super(`No recorded answer for this ask (${key})`)
    this.name = "MissingRecordingError"
  }
}
