import * as z from "zod"

const alpha = "[A-Za-z]"
const alphanum = "[A-Za-z0-9]"
const language = `(?:${alpha}{2,3}(?:-${alpha}{3}){0,3}|${alpha}{4,8})`
const script = `-${alpha}{4}`
const region = `-(?:${alpha}{2}|\\d{3})`
const variant = `-(?:${alphanum}{5,8}|\\d${alphanum}{3})`
const extension = `-[0-9A-WY-Za-wy-z](?:-${alphanum}{2,8})+`
const privateUse = `-[Xx](?:-${alphanum}{1,8})+`

// RFC 5646's langtag production. Its grandfathered and private-use-only
// forms are left out because Intl can't look them up.
export const languageTagSchema = z
  .string()
  .max(64)
  .regex(
    new RegExp(
      `^${language}(?:${script})?(?:${region})?(?:${variant})*(?:${extension})*(?:${privateUse})?$`
    ),
    "Must be a BCP 47 language tag, for example en or fr-CA"
  )
