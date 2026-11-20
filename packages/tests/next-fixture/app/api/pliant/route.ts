import { MockLanguageModelV4 } from "ai/test"

import { createPliantHandler } from "@pliantui/server"

const handler = createPliantHandler({
  model: new MockLanguageModelV4(),
  getUser: () => "anonymous",
})

export async function POST(request: Request) {
  return handler(request)
}
