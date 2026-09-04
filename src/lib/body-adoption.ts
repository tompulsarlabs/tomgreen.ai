/**
 * Keeping a scene rather than replacing it.
 *
 * The planetary scene used to be thrown away and rebuilt every time a visitor
 * descended into a section - a new component, a new canvas, a new GL context,
 * every program recompiled and every texture re-uploaded. That was never what
 * the scene was written for; its own comment says a new body set is a new
 * system it draws itself together into. And it is not what the capture engine
 * can live with either: a parent's capture releases its child system INSIDE
 * the same event, while the baked plate is still on screen and the clock is
 * still running, so there is no moment at which a GL context may be discarded.
 *
 * What the remount used to do for free was forget. Everything the scene knows
 * about a body is keyed by that body's id and lives in a Map that outlives any
 * particular set: where its nameplate is anchored, how wide that nameplate
 * measured, which frame it was last drawn in, how far its hover has eased. A
 * scene that persists keeps all of it, and a section entered forty times in a
 * session would carry the residue of forty systems.
 *
 * So forgetting is explicit, and it is here rather than in the frame loop
 * because it is the part that is worth proving: a Map that grows by a few
 * entries per descent is invisible in every screenshot and is still a leak.
 */

/**
 * Drop everything that is not in the arriving set, from every store that is
 * keyed by body id. Returns how many entries went, which is the number a test
 * can watch instead of a screenshot.
 *
 * By subtraction rather than by clearing: a set that shares bodies with the
 * one before it keeps their measured nameplate boxes and settled anchors, so
 * stepping back to a system it has already drawn does not re-measure it or
 * re-derive where its labels sit.
 */
export function pruneToLiveBodies(
  maps: readonly Map<string, unknown>[],
  live: ReadonlySet<string>,
): number {
  let removed = 0;
  for (const map of maps) {
    for (const id of Array.from(map.keys())) {
      if (!live.has(id)) {
        map.delete(id);
        removed += 1;
      }
    }
  }
  return removed;
}

/**
 * The slots a fixed-size shader array is not using.
 *
 * The membrane shades contact from all of its body slots unconditionally -
 * there is no count uniform to compare against - so a set of three bodies
 * arriving after a set of eight leaves five slots still describing planets
 * that are gone, dimpling the fabric where nothing is. They are parked far
 * enough away to have no influence rather than zeroed, because the origin is
 * where the core is.
 */
export function idleBodySlots(used: number, capacity: number): number[] {
  const slots: number[] = [];
  for (let i = Math.max(0, used); i < capacity; i += 1) slots.push(i);
  return slots;
}
