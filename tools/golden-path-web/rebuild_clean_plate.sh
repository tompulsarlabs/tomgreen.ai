#!/usr/bin/env bash
# Rebuild the actual shipping gas assets. Leaves the paper master untouched.
# Optional: BLENDER=/path/to/blender GP_DEVICE=METAL GP_PYTHONPATH=/deps
#           GP_OIDN_LIBRARY=/path/to/libOpenImageDenoise.dylib
# Usage: rebuild_clean_plate.sh [fresh-cache-tag] [working-output]
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
PROOF="$ROOT/tools/blender/golden-path-proof"
TAG=${1:-seq5-clean}
OUT=${2:-$HERE/plate}
cd "$ROOT"

py() {
  if [ -n "${BLENDER:-}" ]; then
    "$BLENDER" --background --factory-startup --python-exit-code 1 \
      --python "$PROOF/run_script.py" -- "$@"
  else
    python3 "$@"
  fi
}

if [ ! -f "${GP_CACHE:-$PROOF/cache}/volume/meta.json" ]; then
  py "$PROOF/build_volume.py"
fi
py "$PROOF/build_scene.py"
py "$PROOF/render_review.py" --seq3 --cache-tag "$TAG" \
  --device "${GP_DEVICE:-CPU}" --frames 33 103 --render-only
py "$PROOF/audit_fragments.py" --tag "$TAG" --expect-no-solids
py "$HERE/make_bg.py" --pass a --cache-tag "$TAG" --out "$OUT"
py "$HERE/make_maponly.py" --cache-tag "$TAG" --out "$OUT"
py "$HERE/derive_plate.py" --cache-tag "$TAG" --out "$OUT"
bash "$HERE/encode_plates.sh" "$OUT" "$OUT/web" --plates-only

# Only a complete, audited encode can replace the served files.
for tier in high medium low; do
  for ext in mp4 webm; do
    test -s "$OUT/web/golden-path-plate-$tier.$ext"
  done
done
for tier in high medium low; do
  for ext in mp4 webm; do
    cp "$OUT/web/golden-path-plate-$tier.$ext" "$ROOT/public/golden-path/"
  done
done
