import { defineCloudflareConfig } from "@opennextjs/cloudflare"
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache"

// Every page is prerendered and nothing regenerates at runtime, so the
// read-only cache served from the static assets is enough, and cached pages
// skip rendering. The GitHub star count in the header is read when the site is
// built and stays until the next deploy.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
})
