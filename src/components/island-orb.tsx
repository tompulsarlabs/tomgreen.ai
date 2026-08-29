"use client";

import { useEffect, useRef } from "react";

/** Degrees per frame at idle — about one turn every twenty seconds. */
const IDLE_SPIN = 0.3;
/** Pointer travel, in px, past which a drag is a spin and not a click. */
const DRAG_SLOP = 4;
/** How far off the equator the bearing will tilt before it stops. */
const TILT_LIMIT = 78;

/**
 * The island's resting face: a carbon ball bearing the visitor can spin
 * on any axis.
 *
 * The surface turns and the light does not — the marks ride a preserve-3d
 * shell while the specular, the bounce and the limb sit fixed above it in
 * ::after, because a light source does not orbit the thing it lights.
 * Orientation lives in two custom properties rather than a keyframe, so
 * a drag can take the bearing over mid-turn and hand it back without a
 * seam. With no JavaScript the CSS keyframe still turns it.
 */
export function IslandOrb() {
  const shellRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const shell = shellRef.current;
    const orb = shell?.parentElement;
    if (!shell || !orb) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Taking over from the stylesheet: the keyframe is the no-JS path.
    orb.dataset.driven = "true";

    let rx = -9;
    let ry = -64;
    let vx = 0;
    let vy = IDLE_SPIN;
    let dragging = false;
    let pointer = 0;
    let lastX = 0;
    let lastY = 0;
    let travelled = 0;
    let frame = 0;

    const apply = () => {
      shell.style.setProperty("--orb-rx", `${rx.toFixed(2)}deg`);
      shell.style.setProperty("--orb-ry", `${ry.toFixed(2)}deg`);
    };

    const tick = () => {
      if (!dragging) {
        // A thrown bearing keeps its spin, sheds it, and settles back to
        // the idle turn; the tilt always returns to level.
        const target = reduce.matches ? 0 : IDLE_SPIN;
        vy += (target - vy) * 0.018;
        vx *= 0.93;
        rx += vx;
        ry += vy;
        rx += (0 - rx) * 0.012;
      }
      apply();
      frame = requestAnimationFrame(tick);
    };

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      pointer = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      travelled = 0;
      vx = 0;
      vy = 0;
      orb.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== pointer) return;
      const dx = (event.clientX - lastX) * 0.9;
      const dy = (event.clientY - lastY) * 0.9;
      lastX = event.clientX;
      lastY = event.clientY;
      travelled += Math.abs(dx) + Math.abs(dy);
      ry += dx;
      rx = Math.max(-TILT_LIMIT, Math.min(TILT_LIMIT, rx - dy));
      // Velocity is the last frame's travel, so releasing mid-sweep
      // throws the bearing at the speed it was actually moving.
      vx = -dy;
      vy = dx;
      apply();
    };

    const endDrag = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== pointer) return;
      dragging = false;
      if (orb.hasPointerCapture(event.pointerId)) orb.releasePointerCapture(event.pointerId);
      if (travelled <= DRAG_SLOP) return;
      // A spin is not a click: swallow exactly the one activation this
      // gesture would otherwise fire on the surrounding link.
      const swallow = (click: MouseEvent) => {
        click.preventDefault();
        click.stopPropagation();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      // If no click follows (touch, cancelled gesture), do not leave the
      // listener armed to eat the next real one.
      window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 350);
    };

    // A bearing is dragged, never dragged-and-dropped.
    const onDragStart = (event: Event) => event.preventDefault();

    orb.addEventListener("pointerdown", onPointerDown);
    orb.addEventListener("pointermove", onPointerMove);
    orb.addEventListener("pointerup", endDrag);
    orb.addEventListener("pointercancel", endDrag);
    orb.addEventListener("dragstart", onDragStart);
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      orb.removeEventListener("pointerdown", onPointerDown);
      orb.removeEventListener("pointermove", onPointerMove);
      orb.removeEventListener("pointerup", endDrag);
      orb.removeEventListener("pointercancel", endDrag);
      orb.removeEventListener("dragstart", onDragStart);
      delete orb.dataset.driven;
    };
  }, []);

  return (
    <span aria-hidden className="island-orb">
      <span ref={shellRef} className="orb-shell">
        <span className="orb-mark orb-mark-1" />
        <span className="orb-mark orb-mark-2" />
        <span className="orb-mark orb-mark-3" />
        <span className="orb-mark orb-mark-4" />
        <span className="orb-mark orb-mark-5" />
        <span className="orb-mark orb-mark-6" />
      </span>
    </span>
  );
}
