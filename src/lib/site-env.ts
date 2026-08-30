// Pre-launch deploys live on a vercel.app URL and must stay out of search
// indexes. Set SITE_LAUNCHED=1 in the production environment at DNS cutover;
// the root metadata and robots.ts both key off this flag.
export const isLaunched = process.env.SITE_LAUNCHED === "1";
