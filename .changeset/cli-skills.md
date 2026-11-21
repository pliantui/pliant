---
"pliantui": minor
---

Add `pliantui skills add`, which copies Pliant's skills for coding agents into your project: to `.claude/skills` if the project has a `.claude` folder, otherwise to `.agents/skills`, or to the folder you give with `--dir`. The first skill, `setup`, guides an agent through adding Pliant to a Next.js and shadcn app. Run the command again to update the skills; it asks before it overwrites files you changed, and `--yes` skips the question. `pliantui skills list` shows what comes with the package.
