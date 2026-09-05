#!/usr/bin/env bash
# Lay the review frames out as a contact sheet, so the integration can be read
# against contact-sheet-v3-motion.jpg beat for beat rather than by impression.
#
#   tools/golden-path-web/contact_sheet.sh <frames-dir> <out.jpg>
#
# The frames come from e2e/golden-path-sheet.mjs, which holds the shot's clock
# at twenty evenly spaced beats across its 4.8 seconds and photographs each.
# They are already the beats; this only arranges them and labels them.
set -euo pipefail

SRC=${1:?frames directory}
OUT=${2:?output jpg}

COLS=5
ROWS=4
TILE_W=384

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

i=0
for f in "$SRC"/*.png; do
  # 00-1.26s.png -> 1.26s
  label=$(basename "$f" .png | sed 's/^[0-9]*-//')
  ffmpeg -nostdin -loglevel error -i "$f" -frames:v 1 \
    -vf "scale=${TILE_W}:-2,drawtext=text='${label}':x=10:y=h-th-8:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=5" \
    "$WORK/$(printf '%02d' "$i").png"
  i=$((i + 1))
done

if [ "$i" -eq 0 ]; then
  echo "no frames in $SRC" >&2
  exit 2
fi

ffmpeg -nostdin -loglevel error -pattern_type glob -i "$WORK/*.png" \
  -filter_complex "tile=${COLS}x${ROWS}:margin=8:padding=6:color=#101014" \
  -frames:v 1 -q:v 3 -y "$OUT"

echo "contact sheet: $OUT ($i frames)"
