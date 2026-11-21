import * as React from "react"
import Link from "next/link"
import { cn } from "cn"

import { Callout } from "@/components/callout"
import { CopyButton } from "@/components/copy-button"
import { getIconForLanguageExtension } from "@/components/icons"

function HeadingAnchor({
  id,
  children,
}: {
  id: string | undefined
  children: React.ReactNode
}) {
  if (!id) return children

  return (
    <a className="group no-underline" href={`#${id}`}>
      <span className="underline-offset-4 group-hover:underline">
        {children}
      </span>
      <span
        aria-hidden="true"
        className="ml-2 text-muted-foreground opacity-0 group-hover:opacity-100"
      >
        #
      </span>
    </a>
  )
}

function createHeading(Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") {
  function Heading({ children, id, ...props }: React.ComponentProps<"h2">) {
    return (
      <Tag {...props} {...(id === undefined ? {} : { id })}>
        <HeadingAnchor id={id}>{children}</HeadingAnchor>
      </Tag>
    )
  }
  return Heading
}

export const mdxComponents = {
  h1: createHeading("h1"),
  h2: createHeading("h2"),
  h3: createHeading("h3"),
  h4: createHeading("h4"),
  h5: createHeading("h5"),
  h6: createHeading("h6"),
  // Typeset tables stay real tables and wrap to fit; wrap them to scroll
  // wide ones horizontally instead.
  table: (props: React.ComponentProps<"table">) => (
    <div className="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table {...props} />
    </div>
  ),
  pre: ({ className, children, ...props }: React.ComponentProps<"pre">) => (
    <pre
      data-not-typeset
      className={cn(
        "no-scrollbar min-w-0 overflow-x-auto overflow-y-auto overscroll-x-contain overscroll-y-auto px-4 py-3.5 outline-none has-data-highlighted-line:px-0 has-data-line-numbers:px-0 has-data-[slot=tabs]:p-0",
        className
      )}
      {...props}
    >
      {children}
    </pre>
  ),
  figcaption: ({
    className,
    children,
    ...props
  }: React.ComponentProps<"figcaption"> & { "data-language"?: string }) => (
    <figcaption
      className={cn(
        "flex items-center gap-2 text-code-foreground [&_svg]:size-4 [&_svg]:text-code-foreground [&_svg]:opacity-70",
        className
      )}
      {...props}
    >
      {props["data-language"]
        ? getIconForLanguageExtension(props["data-language"])
        : null}
      {children}
    </figcaption>
  ),
  code: ({
    __raw__,
    ...props
  }: React.ComponentProps<"code"> & { __raw__?: string }) => {
    if (typeof props.children === "string") return <code {...props} />

    return (
      <>
        {__raw__ && <CopyButton value={__raw__} />}
        <code {...props} />
      </>
    )
  },
  Callout,
  Link,
}
