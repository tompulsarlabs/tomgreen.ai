/**
 * One clock for the whole shot, and the only thing in the feature whose
 * survival is load-bearing.
 *
 * The cinematic starts in the planetary portal and ends on /work/zalando,
 * so its clock has to outlive a route change. It is a module singleton
 * rather than React state, a context or a ref, because module identity
 * across a client-side navigation is a property of the JavaScript module
 * registry and not of React reconciliation: nothing in the tree has to stay
 * mounted for the shot to keep its time. performance.now() is monotonic for
 * the life of the document and a push is a same-document navigation, so the
 * origin taken at the press is still the origin after the route changes.
 *
 * The terminal teardown lives HERE and runs synchronously, never in an
 * animation frame. A hidden tab, a dead decoder or a closed portal all stop
 * rAF, and if the loop owned the teardown any of them would strand the page
 * holding its own masthead invisible. Every exit — finished, aborted,
 * hidden, watchdog — goes through settle(), which is idempotent.
 */
import { T_END, goldenMotionAt } from "@/lib/golden-path";

export type GoldenPhase = "idle" | "running" | "landing" | "done" | "aborted";

export type GoldenTier = "high" | "medium" | "low" | "none";

/**
 * How this capture resolves, decided once at the press and never re-derived.
 *
 * The event is identical for both up to its resolution phase; this is the only
 * thing that differs, and it has to be knowable from inside the frame loop.
 * "paper" collapses depth and hands the frame to the real page. "children"
 * releases the captured body's own system out of the remnant, which means the
 * whiteout and the erase quad must stay at zero for the whole shot - an erase
 * quad that armed here would dissolve the canvas carrying the system the
 * capture exists to deliver.
 */
export type GoldenEnding = "paper" | "children";

export type GoldenState = {
  phase: GoldenPhase;
  /** performance.now() at the accepted press. */
  originMs: number;
  bodyId: string | null;
  href: string | null;
  fromPath: string | null;
  tier: GoldenTier;
  ending: GoldenEnding;
  pushed: boolean;
};

const IDLE: GoldenState = {
  phase: "idle",
  originMs: 0,
  bodyId: null,
  href: null,
  fromPath: null,
  tier: "none",
  ending: "paper",
  pushed: false,
};

/** The shot clock reads 0.35 s at the press: the render's own CAPTURE_START. */
const PRESS_T = 0.35;

/** Long enough that a stalled shot always ends, short enough to be a backstop. */
const WATCHDOG_MS = (T_END - PRESS_T + 0.9) * 1000;

let state: GoldenState = IDLE;
let listeners: Array<() => void> = [];
let watchdog: number | null = null;

function emit() {
  for (const l of listeners) l();
}

export function subscribeGoldenPath(cb: () => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

export function getGoldenState(): Readonly<GoldenState> {
  return state;
}

/**
 * The clock. Seconds on the shot, clamped to it, so a consumer can never be
 * handed a time the render never drew.
 */
/**
 * A held time, for visual review only.
 *
 * The shot is 4.8 s of wall clock, which is exactly what makes it
 * unphotographable on a machine that rasterises WebGL on the CPU: a single
 * screenshot there costs more than the whole shot. Holding the clock lets a
 * reviewer see the real shaders, the real plate, the real map and the real
 * page at an exact beat and lay it beside the approved frame.
 *
 * It exists only in a build made with NEXT_PUBLIC_GOLDEN_REVIEW=1. The
 * comparison is against a literal Next replaces at build time, so in the
 * shipped bundle this is `if ("undefined" === "1")` and the block is dead
 * code; tools/golden-path-web/assert_no_review_hook.sh greps the built
 * chunks to prove it rather than trusting the argument.
 */
const REVIEW = process.env.NEXT_PUBLIC_GOLDEN_REVIEW === "1";
let heldT: number | null = null;

export function goldenShotTime(): number {
  if (REVIEW && heldT !== null) return heldT;
  if (state.phase === "idle") return 0;
  if (state.phase === "done" || state.phase === "aborted") return T_END;
  const elapsed = (performance.now() - state.originMs) / 1000;
  return Math.min(Math.max(PRESS_T + elapsed, 0), T_END);
}

/** True only while a review build is holding the clock at a beat. */
export function goldenIsHeld() {
  return REVIEW && heldT !== null;
}

if (REVIEW && typeof window !== "undefined") {
  (window as unknown as { __goldenHold?: (t: number | null) => void }).__goldenHold = (t) => {
    heldT = t === null ? null : Math.min(Math.max(t, 0), T_END);
    // The watchdog would end a held shot at its own pace, and the review
    // build has no wall clock to answer to.
    if (heldT !== null && watchdog !== null) {
      window.clearTimeout(watchdog);
      watchdog = null;
    }
    emit();
  };
}

export function goldenIsRunning() {
  return state.phase === "running" || state.phase === "landing";
}

/**
 * True while the running shot ends in paper.
 *
 * Read from the frame loop, so it answers for the shot that is actually
 * running rather than for whatever was armed last: with no shot running the
 * paper channels must be dead, not merely idle.
 */
export function goldenTakesPaper() {
  return goldenIsRunning() && state.ending === "paper";
}

/** True for the body the shot is playing for, and no other. */
export function goldenIsBody(id: string) {
  return goldenIsRunning() && state.bodyId === id;
}

function root(): HTMLElement | null {
  return typeof document === "undefined" ? null : document.documentElement;
}

/**
 * The page's own state, set once and cleared once.
 *
 * `golden-landing` holds the case study's opening block while the shot is
 * still the subject; `golden-typography` releases it as one complete
 * composition. Both classes sit on <html>, which also carries `.js`, so the
 * stylesheet must pair them as a compound selector — a descendant selector
 * would silently never match and the masthead would be visible from the
 * moment of the push.
 */
function markLanding() {
  const el = root();
  if (!el) return;
  // The two classes are phases of one shot and must never both be set. The
  // typography rule sits later in the stylesheet at equal specificity, so a
  // leftover from the previous capture wins over this one's hold and the
  // masthead is simply never held again - visibly correct on the first
  // capture of a session and silently broken on every one after it.
  el.classList.remove("golden-typography");
  el.classList.add("golden-landing");
  el.dataset.goldenPhase = "landing";
}

/**
 * Release the masthead, as one complete composition.
 *
 * Separate from settle() because the two happen at different instants and
 * for different reasons: the approved shot brings the typography in at
 * 3.03 s, while the portal only closes at 3.60 s. Folding them together
 * published the whole masthead half a second late - after the paper had
 * already arrived, so the page appeared blank and then filled in. Idempotent,
 * because settle() calls it again on the way out and so does every recovery.
 */
function releaseTypography() {
  const el = root();
  if (!el) return;
  el.classList.remove("golden-landing");
  el.classList.add("golden-typography");
}

export function markGoldenTypography() {
  if (state.phase !== "landing" && state.phase !== "running") return;
  releaseTypography();
}

function settle() {
  const el = root();
  if (el) {
    releaseTypography();
    el.dataset.goldenPhase = "done";
  }
  if (watchdog !== null) {
    window.clearTimeout(watchdog);
    watchdog = null;
  }
}

/** Nothing of the shot is left on the page: used when it never landed. */
function clearAll() {
  const el = root();
  if (el) {
    el.classList.remove("golden-landing");
    el.classList.remove("golden-typography");
    delete el.dataset.goldenPhase;
  }
  if (watchdog !== null) {
    window.clearTimeout(watchdog);
    watchdog = null;
  }
}

export function armGoldenPath(input: {
  bodyId: string;
  href: string;
  fromPath: string;
  tier: GoldenTier;
  ending?: GoldenEnding;
}): boolean {
  if (input.tier === "none") return false;
  if (goldenIsRunning()) return false;
  // A capture begins on a page carrying nothing from the last one. Arming is
  // the only moment that is true for certain: the portal closes down several
  // paths and the visitor may take a second capture without any of them
  // running.
  clearAll();
  state = {
    phase: "running",
    originMs: performance.now(),
    bodyId: input.bodyId,
    href: input.href,
    fromPath: input.fromPath,
    tier: input.tier,
    ending: input.ending ?? "paper",
    pushed: false,
  };
  watchdog = window.setTimeout(() => finishGoldenPath(), WATCHDOG_MS);
  emit();
  return true;
}

/** The route has been pushed underneath the still-opaque portal. */
export function markGoldenPushed() {
  if (!goldenIsRunning() || state.pushed) return;
  state = { ...state, phase: "landing", pushed: true };
  markLanding();
  emit();
}

/**
 * The shot is over and the page is whole. Safe to call from anywhere, any
 * number of times, including from a visibility change or a watchdog: the
 * model is closed form, so settling cold is exactly the state playing out
 * would have reached.
 */
export function finishGoldenPath() {
  if (state.phase === "done") return;
  const wasPushed = state.pushed;
  state = { ...state, phase: "done" };
  if (wasPushed) settle();
  else clearAll();
  emit();
}

/**
 * The visitor left before the page arrived. If the route had already been
 * pushed there is a page to settle and we settle it; only a shot that never
 * navigated may clear everything and hand the portal back.
 */
export function abortGoldenPath(reason: "escape" | "popstate" | "error" | "hidden") {
  if (state.phase === "idle" || state.phase === "aborted") return;
  const wasPushed = state.pushed;
  state = { ...state, phase: wasPushed ? "done" : "aborted" };
  if (wasPushed) settle();
  else clearAll();
  emit();
  void reason;
}

/** Back to rest, so a second visit starts from a clean clock. */
export function resetGoldenPath() {
  clearAll();
  state = IDLE;
  emit();
}

/** The state every consumer derives from, evaluated once per frame. */
export function goldenMotionNow() {
  return goldenMotionAt(goldenShotTime());
}
