/**
 * Splits a component name into words. Acronyms and numbered words stay
 * whole: InputOTP is "Input OTP", Toggle3D is "Toggle 3D", Grid2x2 is
 * "Grid 2x2" and HTML5Video is "HTML5 Video".
 */
export function splitWords(name: string) {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([a-z]{2})(\d)/g, "$1 $2")
    .replace(/(\d)([A-Z][a-z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
}
