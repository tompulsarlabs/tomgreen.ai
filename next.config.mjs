// @ts-check

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // Lets the Vercel contract script build with VERCEL=1 into an isolated
  // directory instead of clobbering the working .next build.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
