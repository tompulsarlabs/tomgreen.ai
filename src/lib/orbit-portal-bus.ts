/**
 * One channel between the moon and the world it opens.
 *
 * The moon lives in the site header and the portal is mounted beside the
 * route shell, so they are siblings with no parent to hold the state
 * between them. A context provider would mean wrapping the whole tree in
 * a client component to carry one boolean; a window event carries it
 * without that, and keeps the portal free to mount wherever it needs to
 * so its overlay is never clipped by a page's stacking context.
 */
const OPEN_EVENT = "orbit-portal:open";

/** Ask for the planetary map. Called by the moon, and nothing else. */
export function openOrbitPortal() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

/** Listen for that request. Returns its own unsubscribe. */
export function onOrbitPortalOpen(handler: () => void) {
  window.addEventListener(OPEN_EVENT, handler);
  return () => window.removeEventListener(OPEN_EVENT, handler);
}
