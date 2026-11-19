import { createMDX } from "fumadocs-mdx/next"

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/api/pliant": ["./recordings/*.json"],
  },
}

export default withMDX(nextConfig)
