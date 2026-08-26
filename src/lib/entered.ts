/**
 * Run a callback once the first-visit entrance cover has lifted (html no
 * longer carries `entering`). Fires immediately when there is no cover —
 * repeat visits, reduced motion, no entrance at all. Returns a cancel
 * function for effect cleanup.
 *
 * Exists so under-layer choreography (count-ups, backdrop loops) doesn't
 * play and finish invisibly beneath the opaque entrance.
 */
export function whenEntered(cb: () => void): () => void {
  const root = document.documentElement;
  if (!root.classList.contains("entering")) {
    cb();
    return () => {};
  }
  const mo = new MutationObserver(() => {
    if (!root.classList.contains("entering")) {
      mo.disconnect();
      cb();
    }
  });
  mo.observe(root, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
}
