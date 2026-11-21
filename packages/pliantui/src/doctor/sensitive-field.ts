import { splitWords } from "../manifest/split-words"

// Words that often name personal or secret data. A field matches when one
// of the words in its name, split at camelCase, `_` and `-`, is in the list.
const sensitiveWords = new Set([
  "email",
  "phone",
  "ssn",
  "salary",
  "password",
  "token",
  "secret",
  "address",
  "dob",
  "birth",
  "birthday",
])

const sensitiveTypes = new Set(["email"])

/** Whether a field's name or type suggests it holds personal or secret data. */
export function looksSensitive(name: string, type: string | null) {
  return (
    (type !== null && sensitiveTypes.has(type)) ||
    splitWords(name).some((word) => sensitiveWords.has(word.toLowerCase()))
  )
}
