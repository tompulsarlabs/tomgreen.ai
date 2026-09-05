// @ts-check

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // Lets the Vercel contract script build with VERCEL=1 into an isolated
  // directory instead of clobbering the working .next build.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  env: {
    // Declared here so it is always a literal in the output. Left to the
    // ambient environment it compiles to a live process.env lookup, and the
    // golden path's review clock - which must not exist in a shipped bundle
    // at all - would survive minification as dead-but-present code. Pinned
    // to "0" it folds to false and the block is removed;
    // tools/golden-path-web/assert_no_review_hook.sh proves it.
    NEXT_PUBLIC_GOLDEN_REVIEW: process.env.NEXT_PUBLIC_GOLDEN_REVIEW || "0",
  },
};

export default nextConfig;
