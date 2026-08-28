// Pre-launch deploys live on a vercel.app URL and must stay out of search
// indexes. Set SITE_LAUNCHED=1 in the production environment at DNS cutover;
// the root metadata and robots.ts both key off this flag.
export const isLaunched = process.env.SITE_LAUNCHED === "1";

// Keep the unfinished About journey available in local development and on
// SSO-protected Vercel preview deployments (so it can be reviewed before
// launch) without exposing it on Vercel production.
export function isAboutAvailable(
  environment: Record<string, string | undefined> = process.env,
) {
  return environment.VERCEL_ENV !== "production";
}

export const isAboutPublic = isAboutAvailable();
