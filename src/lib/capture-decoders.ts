import { FPS } from "@/lib/golden-path";

/**
 * How a baked decoder follows the shot clock.
 *
 * The clock is the authority and the video is a follower, never the other way
 * round: the shot's timing is the approved edit, and a decoder that dictated
 * it would make the pacing a property of how fast this device happens to
 * decode. So each frame the decoder is told what second the shot is on, and it
 * closes the gap the cheapest way available - by playing slightly faster or
 * slower. Seeking is the expensive way, because a seek aborts the decode in
 * flight, and a decoder that seeks every frame shows one stale frame forever.
 *
 * This lives outside the component because it is where the interesting
 * mistakes are, and a mistake inside a frame loop inside a canvas can only be
 * caught by looking at pixels. Everything here is decided from four numbers.
 */

/** Only the parts of a media element this needs, so a test can be a plain object. */
export type Follower = {
  currentTime: number;
  readonly duration: number;
  playbackRate: number;
  paused: boolean;
  play: () => void;
  pause: () => void;
};

/** Beyond this the decoder is lost and a seek is cheaper than catching up. */
export const RESEEK_ERROR = 0.5;

/** What a decoder may be asked to do to close a gap it can still close. */
export const MIN_RATE = 0.5;
export const MAX_RATE = 2.5;

export type FollowAction = "idle" | "seek" | "hold" | "follow";

export function followDecoder(
  video: Follower,
  /** Where the shot says this decoder should be, in its own media time. */
  target: number,
  options: {
    /** False until the decoder has been placed once. */
    seeded: boolean;
    /** The shot clock is stopped on a beat, so the decoder must be exact. */
    held?: boolean;
    /** How fast shot time is running against the wall right now. */
    rate?: number;
  },
): FollowAction {
  // Before this decoder's window opens there is nothing for it to show.
  if (target < 0) return "idle";

  // Past the end of the media there is nothing to follow either, and this is
  // the case that bites: currentTime clamps at duration, so the error can
  // never converge, and a follower that reseeks on a large error would issue
  // a seek and a play on every single frame - aborting the decode each time
  // and freezing the picture on whatever frame survived. Hold the last frame.
  const { duration } = video;
  if (Number.isFinite(duration) && duration > 0 && target > duration - 1 / FPS) {
    if (!video.paused) video.pause();
    return "hold";
  }

  // A held clock is not a clock a decoder can chase: it does not advance
  // between beats, so following it means standing exactly on the frame asked
  // for rather than drifting toward it.
  if (options.held) {
    if (!video.paused) video.pause();
    if (Math.abs(video.currentTime - target) > 1 / FPS) {
      video.currentTime = Math.max(0, target);
    }
    return "seek";
  }

  const error = video.currentTime - target;
  if (!options.seeded || Math.abs(error) > RESEEK_ERROR) {
    video.currentTime = Math.max(0, target);
    video.play();
    return "seek";
  }

  // The base rate is how fast the shot itself is running - a compact capture
  // asks the plate to cover authored seconds faster than real ones, and no
  // amount of correction inside a narrow band around 1.0 would ever get
  // there. The correction rides on top of it.
  const base = options.rate ?? 1;
  const correction = Math.abs(error) > 1 / FPS / 2 ? 1 - error * 1.5 : 1;
  video.playbackRate = Math.min(MAX_RATE, Math.max(MIN_RATE, base * correction));
  return "follow";
}
