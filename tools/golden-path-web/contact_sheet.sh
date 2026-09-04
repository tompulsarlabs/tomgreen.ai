#!/usr/bin/env bash
# Lays a browser recording out as a 20-frame contact sheet on the approved
# beats, so the integration can be read against contact-sheet-v3-motion.jpg
# frame for frame rather than by impression.
#
#   tools/golden-path-web/contact_sheet.sh <recording.webm> <press-offset-s> <out.jpg>
#
# The shot is 4.8 s on its own clock and the press lands at t = 0.35 s, so
# frame n of 20 is taken at press-offset - 0.35 + n * 4.8 / 19.
set -euo pipefail

SRC=${1:?recording}
PRESS=${2:?press offset in seconds}
OUT=${3:?output jpg}

T_END=4.8
PRESS_T=0.35
COLS=5
ROWS=4
COUNT=$((COLS * ROWS))
TILE_W=384

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# Shot time zero in the recording's own clock.
ZERO=$(python3 -c "print(f'{$PRESS - $PRESS_T:.4f}')")

for i in $(seq 0 $((COUNT - 1))); do
  T=$(python3 -c "print(f'{$ZERO + $i * $T_END / ($COUNT - 1):.4f}')")
  SHOT=$(python3 -c "print(f'{$i * $T_END / ($COUNT - 1):.2f}')")
  ffmpeg -nostdin -loglevel error -ss "$T" -i "$SRC" -frames:v 1 \
    -vf "scale=${TILE_W}:-1,drawtext=text='${SHOT}s':x=10:y=h-th-8:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=5" \
    "$WORK/$(printf '%02d' "$i").png"
done

ffmpeg -nostdin -loglevel error -pattern_type glob -i "$WORK/*.png" \
  -filter_complex "tile=${COLS}x${ROWS}:margin=8:padding=6:color=#101014" \
  -frames:v 1 -q:v 3 -y "$OUT"

echo "contact sheet: $OUT"
