import { chromium } from "@playwright/test"
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1600, height: 800 }, colorScheme: "dark" })
for (const [u, f] of [["https://feat-www-shadcn-shell-pliantui-www.pliantui-dev.workers.dev/docs/installation","ours"],["https://ui.shadcn.com/docs","shadcn"]]) {
  await p.goto(u, { waitUntil: "networkidle" }); await p.screenshot({ path: process.argv[2] + "/" + f + ".png" })
}
await b.close()
