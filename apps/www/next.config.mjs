import { createMDX } from "fumadocs-mdx/next"

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The components live in the docs, as on ui.shadcn.com.
  async redirects() {
    return [
      {
        source: "/components",
        destination: "/docs/components",
        permanent: true,
      },
    ]
  },
}

export default withMDX(nextConfig)
