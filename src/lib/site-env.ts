// Pre-launch deploys live on a vercel.app URL and must stay out of search
// indexes. Set SITE_LAUNCHED=1 in the production environment at DNS cutover;
// the root metadata and robots.ts both key off this flag.
export const isLaunched = process.env.SITE_LAUNCHED === "1";

// Keep the unfinished About journey available in local development without
// exposing it on Vercel production or preview deployments.
export function isAboutAvailable(
  environment: Record<string, string | undefined> = process.env,
) {
  return environment.VERCEL !== "1";
}

export const isAboutPublic = isAboutAvailable();
