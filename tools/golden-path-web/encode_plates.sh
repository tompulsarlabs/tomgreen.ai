#!/bin/bash
# Encode the derived event plate into stacked-matte H.264 tiers.
#
# One file per tier carries colour on top and its matte below in a single H.264 stream:
# alpha video (VP9/WebM, HEVC-with-alpha) is not safe across Safari/iOS + Chrome + Firefox,
# and a stacked matte needs no alpha support at all - the shader samples both halves and
# reconstructs premultiplied colour. Matte detail lives in luma, which 4:2:0 keeps at full
# resolution, so subsampling costs the matte nothing.
set -e
S=/tmp/claude-0/-home-user-tomgreen-ai/f0b1bf39-d3fe-528c-8d63-c1a722d0b151/scratchpad
SRC=$S/plate
OUT=${1:-$S/plate/web}
mkdir -p "$OUT"
FIRST=$(ls $SRC/rgb | head -1 | sed 's/f0*\([0-9]*\)\.png/\1/')

encode () {   # name  width  height  crf
  local name=$1 w=$2 h=$3 crf=$4
  ffmpeg -y -hide_banner -loglevel error \
    -framerate 30 -start_number $FIRST -i "$SRC/rgb/f%04d.png" \
    -framerate 30 -start_number $FIRST -i "$SRC/matte/f%04d.png" \
    -filter_complex "[0:v]scale=$w:$h:flags=lanczos[c];[1:v]scale=$w:$h:flags=lanczos,format=gray,format=yuv420p[m];[c][m]vstack=inputs=2,format=yuv420p[v]" \
    -map "[v]" -c:v libx264 -profile:v main -level 4.0 -preset slow -crf "$crf" \
    -pix_fmt yuv420p -movflags +faststart -an "$OUT/$name.mp4"
  printf '%-28s %8s bytes  %sx%s\n' "$name.mp4" "$(stat -c %s "$OUT/$name.mp4")" "$w" "$((h*2))"
}

encode golden-path-plate-high   1440 900 20
encode golden-path-plate-medium 1024 640 22
encode golden-path-plate-low     720 448 24
