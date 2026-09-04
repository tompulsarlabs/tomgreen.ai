import { describe, expect, it } from "vitest";
import { MAX_RATE, MIN_RATE, followDecoder, type Follower } from "@/lib/capture-decoders";
import { FPS } from "@/lib/golden-path";

/** The real masters: 70 frames of plate, 28 of paper, both at 30 fps. */
const PLATE_DURATION = 70 / 30;

function follower(overrides: Partial<Follower> = {}): Follower & { plays: number; pauses: number } {
  const state = {
    currentTime: 0,
    duration: PLATE_DURATION,
    playbackRate: 1,
    paused: true,
    plays: 0,
    pauses: 0,
    play() {
      state.plays += 1;
      state.paused = false;
    },
    pause() {
      state.pauses += 1;
      state.paused = true;
    },
    ...overrides,
  };
  return state as Follower & { plays: number; pauses: number };
}

describe("placing a decoder", () => {
  it("does nothing before its window opens", () => {
    const v = follower();
    expect(followDecoder(v, -0.4, { seeded: false })).toBe("idle");
    expect(v.plays).toBe(0);
    expect(v.currentTime).toBe(0);
  });

  it("seeks once to place itself, then never seeks again while it keeps up", () => {
    const v = follower();
    expect(followDecoder(v, 0.5, { seeded: false })).toBe("seek");
    expect(v.currentTime).toBe(0.5);
    expect(v.plays).toBe(1);

    v.currentTime = 0.52;
    expect(followDecoder(v, 0.5, { seeded: true })).toBe("follow");
    expect(v.plays).toBe(1);
  });

  it("re-places itself only when it is properly lost", () => {
    const v = follower({ currentTime: 1.4 });
    expect(followDecoder(v, 0.5, { seeded: true })).toBe("seek");
    expect(v.currentTime).toBe(0.5);
  });
});

describe("past the end of its own media", () => {
  it("holds the last frame instead of seeking every frame forever", () => {
    // The bug this exists to prevent: the plate ends at shot 3.4333 and the
    // shot runs to 4.8. currentTime clamps at duration, so the error can
    // never converge and a naive follower issues a seek AND a play on every
    // animation frame - 24 to 52 of them - each aborting the decode, on the
    // beat where the labels are meant to resolve.
    const v = follower({ currentTime: PLATE_DURATION, paused: false });
    for (let frame = 0; frame < 60; frame += 1) {
      expect(followDecoder(v, PLATE_DURATION + 0.5, { seeded: true })).toBe("hold");
    }
    expect(v.plays).toBe(0);
    expect(v.pauses).toBe(1); // paused once, then left alone
    expect(v.currentTime).toBe(PLATE_DURATION);
  });

  it("holds from the last frame onward, not merely past the duration", () => {
    const v = follower({ currentTime: PLATE_DURATION - 1 / FPS, paused: false });
    expect(followDecoder(v, PLATE_DURATION - 0.001, { seeded: true })).toBe("hold");
  });

  it("still follows normally right up to that point", () => {
    const v = follower({ currentTime: 1.0, paused: false });
    expect(followDecoder(v, 1.0, { seeded: true })).toBe("follow");
  });

  it("is not fooled by a decoder that has not reported its duration yet", () => {
    const v = follower({ duration: NaN });
    expect(followDecoder(v, 5, { seeded: false })).toBe("seek");
    const zero = follower({ duration: 0 });
    expect(followDecoder(zero, 5, { seeded: false })).toBe("seek");
  });
});

describe("following a warped clock", () => {
  it("takes the shot's own rate as its base, not a correction around 1", () => {
    // A compact capture asks the plate to cover 1.40 s of authored gas in
    // 0.65 s. No correction inside a band around 1.0 reaches 2.15x, so the
    // base rate has to be the shot's.
    const v = follower({ currentTime: 1.0, paused: false });
    followDecoder(v, 1.0, { seeded: true, rate: 2.154 });
    expect(v.playbackRate).toBeCloseTo(2.154, 3);
  });

  it("corrects drift on top of that rate rather than instead of it", () => {
    const v = follower({ currentTime: 1.1, paused: false });
    followDecoder(v, 1.0, { seeded: true, rate: 1.667 });
    // Ahead of the target, so slower than the base - but still faster than 1,
    // because the shot itself is running fast.
    expect(v.playbackRate).toBeLessThan(1.667);
    expect(v.playbackRate).toBeGreaterThan(1);
  });

  it("never asks for a rate a decoder will refuse", () => {
    const fast = follower({ currentTime: 0.2, paused: false });
    followDecoder(fast, 1.0, { seeded: true, rate: 2.154 });
    expect(fast.playbackRate).toBeLessThanOrEqual(MAX_RATE);
    const slow = follower({ currentTime: 1.4, paused: false });
    followDecoder(slow, 1.05, { seeded: true, rate: 1 });
    expect(slow.playbackRate).toBeGreaterThanOrEqual(MIN_RATE);
  });

  it("leaves the rate alone when it is already on time", () => {
    const v = follower({ currentTime: 1.0, paused: false });
    followDecoder(v, 1.0, { seeded: true, rate: 1 });
    expect(v.playbackRate).toBe(1);
  });
});

describe("a held clock", () => {
  it("stands exactly on the frame asked for, and stays paused", () => {
    const v = follower({ currentTime: 0.2, paused: false });
    expect(followDecoder(v, 1.0, { seeded: true, held: true })).toBe("seek");
    expect(v.currentTime).toBe(1.0);
    expect(v.paused).toBe(true);
    expect(v.plays).toBe(0);
  });

  it("does not re-seek for less than a frame", () => {
    const v = follower({ currentTime: 1.0, paused: true });
    followDecoder(v, 1.0 + 1 / FPS / 4, { seeded: true, held: true });
    expect(v.currentTime).toBe(1.0);
  });

  it("holds past the end even when held", () => {
    const v = follower({ currentTime: PLATE_DURATION, paused: false });
    expect(followDecoder(v, PLATE_DURATION + 1, { seeded: true, held: true })).toBe("hold");
  });
});
