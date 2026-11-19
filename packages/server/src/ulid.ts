const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

export function ulid(time: number) {
  let timePart = ""
  let rest = time
  for (let index = 0; index < 10; index++) {
    timePart = alphabet.charAt(rest % 32) + timePart
    rest = Math.floor(rest / 32)
  }
  const random = Array.from(
    crypto.getRandomValues(new Uint8Array(16)),
    (byte) => alphabet.charAt(byte % 32)
  ).join("")
  return timePart + random
}
