/**
 * The landing's opening plays once per session, and two doors lead back
 * to it that disagree about that on purpose: the Moon asks for the
 * opening again, the Home label goes straight to the planetary map.
 *
 * Both write the one session key the landing reads when it mounts, so
 * the decision travels with the navigation instead of riding in the URL
 * — the landing's address is "/" whichever door you came through.
 *
 * Private windows refuse session storage. Every helper here swallows
 * that: the worst case is the landing making its own choice, which is
 * the behaviour there was before either door existed.
 */
const SEQUENCE_KEY = "tg-sequence-played";

/** The Moon: play the opening on arrival, however many times before. */
export function requestOpening() {
  try {
    window.sessionStorage.removeItem(SEQUENCE_KEY);
  } catch {
    // No storage: the landing plays or skips on its own reckoning.
  }
}

/** Home, and the sequence itself once it has finished: go to the map. */
export function skipOpening() {
  try {
    window.sessionStorage.setItem(SEQUENCE_KEY, "1");
  } catch {
    // As above — a landing that replays is not worth a thrown error.
  }
}

/** Whether this session has already been shown the opening. */
export function openingAlreadyPlayed(): boolean {
  try {
    return window.sessionStorage.getItem(SEQUENCE_KEY) === "1";
  } catch {
    return false;
  }
}
