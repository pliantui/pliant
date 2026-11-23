import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"

import { ComingSoon } from "@/components/coming-soon"
import { UnfinishedStrip } from "@/components/unfinished-strip"
import { formatPostDate, getPost, posts } from "@/lib/blog"

export const dynamicParams = false

export function generateStaticParams() {
  return posts.map(({ slug }) => ({ slug }))
}

export async function generateMetadata(
  props: PageProps<"/blog/[slug]">
): Promise<Metadata> {
  const post = getPost((await props.params).slug)
  if (!post) notFound()

  return {
    title: post.title,
    description: post.summary,
    alternates: { canonical: `/blog/${post.slug}` },
  }
}

export default async function BlogPostPage(props: PageProps<"/blog/[slug]">) {
  const post = getPost((await props.params).slug)
  if (!post) notFound()

  return (
    <div className="container-wrapper flex-1">
      {post.unfinished && <UnfinishedStrip />}
      <article className="container flex max-w-2xl flex-col gap-4 py-12 md:py-16">
        <Link
          href="/blog"
          className="flex w-fit items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          Blog
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-balance xl:text-4xl">
          {post.title}
        </h1>
        <time dateTime={post.date} className="text-sm text-muted-foreground">
          {formatPostDate(post.date)}
        </time>
        <p className="text-lg text-balance">{post.summary}</p>
        <div className="mt-8 border-t pt-8">
          <ComingSoon>The full post is on its way.</ComingSoon>
        </div>
      </article>
    </div>
  )
}
