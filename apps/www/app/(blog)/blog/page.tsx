import type { Metadata } from "next"
import Link from "next/link"

import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header"
import { UnfinishedDot } from "@/components/unfinished-dot"
import { UnfinishedStrip } from "@/components/unfinished-strip"
import { formatPostDate, posts } from "@/lib/blog"

export const metadata: Metadata = {
  title: "Blog",
  description: "News and announcements from Pliant.",
  alternates: { canonical: "/blog" },
}

export default function BlogPage() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader>
        <PageHeaderHeading>Blog</PageHeaderHeading>
        <PageHeaderDescription>
          News and announcements from Pliant.
        </PageHeaderDescription>
      </PageHeader>
      {posts.some((post) => post.unfinished) && <UnfinishedStrip />}
      <div className="container-wrapper flex-1">
        <ul className="container flex max-w-2xl flex-col gap-2 pb-16">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="flex flex-col gap-1 rounded-xl p-4 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  {post.title}
                  {post.unfinished && <UnfinishedDot />}
                </span>
                <time
                  dateTime={post.date}
                  className="text-sm text-muted-foreground"
                >
                  {formatPostDate(post.date)}
                </time>
                <span className="text-sm text-muted-foreground">
                  {post.summary}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
