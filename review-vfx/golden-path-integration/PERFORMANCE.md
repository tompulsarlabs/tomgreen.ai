# Zalando golden path: what it costs

What this container can measure honestly, and what it cannot. Everything below
is either a count, a byte figure or a code fact. No frame rate is claimed: this
machine rasterises WebGL on the CPU, so any number it produced would be a
property of the container rather than of the work.

## What the shot adds to the scene

| | count |
|---|---:|
| new draw calls while the shot runs | 2 (both full-frustum quads, one of them only after 2.50 s) |
| new draw calls at rest | 0 |
| new shader programs | 2 |
| new textures | 2 (one per decoder) |
| new decoders | 2, and only after the map has opened |
| new DOM elements | 0 — the decoders are never in the document |
| new timers driving the sequence | 0 |
| new render targets, composers, post passes | 0 |

The two quads are drawn for two frames at mount with their uniforms at zero, so
both programs are linked while the map is idle. Without that, the plate's
program would link at 1.10 s and the erase quad's at 2.50 s — inside the
detonation and inside the takeover.

## What a visitor downloads

Nothing on first paint. The masters are requested when the map opens, and again
on hover, focus and idle; one master per visitor, never both.

| tier | resolves for | H.264 kB | VP9 kB |
|---|---|---:|---:|
| high | desktop | 2411 | 1174 |
| medium | laptop, ≤ 4 cores, min side < 760 | 1187 | 636 |
| low | coarse pointer, min side < 480 | 674 | 398 |
| none | reduced motion, save-data, no decoder | 0 | 0 |

Decoded frame sizes are 1440×1800, 1024×1280 and 720×896 — the stacked colour
and matte. The largest is 2.6 MP, inside the project's own 3 MP mobile
backing-store cap, and the tier that a phone resolves to is 0.65 MP.

## What it gives back

`releaseGoldenAssets()` runs on every terminal path — finished, aborted,
hidden, Escape, watchdog. It pauses both decoders, clears their `src` and
reloads them empty, so a visitor who takes the shot ten times holds one pair at
the end rather than ten. The textures follow the decoders: the layer disposes
the previous pair whenever the assets object changes, and both on unmount. The
`a second run arms as cleanly as the first` test walks the whole path twice and
asserts nothing is left behind on either cycle.

The clock clears itself the same way. `settle()` is idempotent and synchronous,
in the store rather than in an animation frame, because a hidden tab, a dead
decoder and a closed portal all stop rAF — and a teardown that lives in the
loop would strand the page holding its own masthead invisible.

## One layout change, deliberately placed

The shot is full-bleed and the portal is not: its chrome sits above the field
in a column, so the canvas stops short of the top of the screen. While the shot
is armed the field takes the whole viewport, which costs one drawing-buffer
resize. It happens at the press — three quarters of a second before the
detonation, on the same beat as a spiral the procedural path also draws — and
nowhere near the takeover.

## The click

Arming is a synchronous decision made from what is already in hand: if the
plate is not decoded, the press takes the site's existing procedural
transition. Both paths share the same first 0.75 s of spiral — the shot's
capture window is exactly the site's own `CAPTURE_SECONDS`, which a unit test
asserts — so the visitor sees a response in the same frame either way, and
never a spinner, a stall or a black frame.

## What is not measured here

- **Frame rate, jank, and the 60/40 fps targets.** CPU rasterisation, so no
  number would mean anything. To be judged on real hardware.
- **Decode cost on a phone.** The tier system exists to bound it, and the
  numbers above bound what is decoded, but the decode itself has not been
  timed on a device.
- **Memory over ten consecutive cycles.** The disposal is asserted by test;
  the heap is not sampled.
