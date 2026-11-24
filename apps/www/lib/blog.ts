export interface BlogPost {
  slug: string
  title: string
  // An ISO date, like "2026-11-23".
  date: string
  summary: string
  // A post whose full text isn't published yet.
  unfinished?: boolean
  // Shows the animated tangram above the post.
  launchArt?: boolean
}

export const posts: readonly BlogPost[] = [
  {
    slug: "introducing-pliant",
    title: "Introducing Pliant",
    date: "2026-11-23",
    summary:
      "Pliant lets the people who use your shadcn app point at any part of it and ask for a change, within the rules you set.",
    unfinished: true,
    launchArt: true,
  },
]

export function getPost(slug: string) {
  return posts.find((post) => post.slug === slug)
}

export function formatPostDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(date))
}
