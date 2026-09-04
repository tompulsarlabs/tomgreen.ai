#!/bin/bash
# Encode the derived event plate and the paper field into the masters the site ships.
#
# One file per tier carries colour on top and its matte below in a single stream: alpha
# video (VP9/WebM, HEVC-with-alpha) is not safe across Safari/iOS + Chrome + Firefox, and a
# stacked matte needs no alpha support at all - the shader samples both halves and
# reconstructs premultiplied colour. Matte detail lives in luma, which 4:2:0 keeps at full
# resolution, so subsampling costs the matte nothing.
#
# Two codecs, because a container is not a decoder. H.264 is the primary: Safari and iOS
# decode nothing else reliably, and it is hardware-decoded almost everywhere. But H.264 is
# licensed, so it is absent from unbranded Chromium builds and from Firefox builds without
# a system decoder - and a browser that cannot decode the plate does not get the shot at
# all. VP9 costs those browsers nothing extra: exactly one master is fetched, chosen by
# canPlayType in golden-path-assets.ts.
set -e
S=/tmp/claude-0/-home-user-tomgreen-ai/f0b1bf39-d3fe-528c-8d63-c1a722d0b151/scratchpad
SRC=$S/plate
OUT=${1:-$S/plate/web}
mkdir -p "$OUT"
FIRST=$(ls $SRC/rgb | head -1 | sed 's/f0*\([0-9]*\)\.png/\1/')
PAPER_FIRST=$(ls $SRC/paper | head -1 | sed 's/f0*\([0-9]*\)\.png/\1/')

stack () {   # name  width  height  crf  vp9crf
  local name=$1 w=$2 h=$3 crf=$4 vcrf=$5
  local chain="[0:v]scale=$w:$h:flags=lanczos[c];[1:v]scale=$w:$h:flags=lanczos,format=gray,format=yuv420p[m];[c][m]vstack=inputs=2,format=yuv420p[v]"
  ffmpeg -y -hide_banner -loglevel error \
    -framerate 30 -start_number $FIRST -i "$SRC/rgb/f%04d.png" \
    -framerate 30 -start_number $FIRST -i "$SRC/matte/f%04d.png" \
    -filter_complex "$chain" \
    -map "[v]" -c:v libx264 -profile:v main -level 4.0 -preset slow -crf "$crf" \
    -pix_fmt yuv420p -movflags +faststart -an "$OUT/$name.mp4"
  ffmpeg -y -hide_banner -loglevel error \
    -framerate 30 -start_number $FIRST -i "$SRC/rgb/f%04d.png" \
    -framerate 30 -start_number $FIRST -i "$SRC/matte/f%04d.png" \
    -filter_complex "$chain" \
    -map "[v]" -c:v libvpx-vp9 -b:v 0 -crf "$vcrf" -row-mt 1 -deadline good -cpu-used 1 \
    -pix_fmt yuv420p -an "$OUT/$name.webm"
  printf '%-30s %9s mp4  %9s webm  %sx%s\n' "$name" \
    "$(stat -c %s "$OUT/$name.mp4")" "$(stat -c %s "$OUT/$name.webm")" "$w" "$((h*2))"
}

# The whiteout field. One channel, so it is written as luma and read as .r.
paper () {
  local name=golden-path-paper
  ffmpeg -y -hide_banner -loglevel error \
    -framerate 30 -start_number $PAPER_FIRST -i "$SRC/paper/f%04d.png" \
    -vf "format=gray,format=yuv420p" \
    -c:v libx264 -profile:v main -level 4.0 -preset slow -crf 15 \
    -pix_fmt yuv420p -movflags +faststart -an "$OUT/$name.mp4"
  ffmpeg -y -hide_banner -loglevel error \
    -framerate 30 -start_number $PAPER_FIRST -i "$SRC/paper/f%04d.png" \
    -vf "format=gray,format=yuv420p" \
    -c:v libvpx-vp9 -b:v 0 -crf 26 -row-mt 1 -deadline good -cpu-used 1 \
    -pix_fmt yuv420p -an "$OUT/$name.webm"
  printf '%-30s %9s mp4  %9s webm\n' "$name" \
    "$(stat -c %s "$OUT/$name.mp4")" "$(stat -c %s "$OUT/$name.webm")"
}

stack golden-path-plate-high   1440 900 20 30
stack golden-path-plate-medium 1024 640 22 32
stack golden-path-plate-low     720 448 24 34
paper
