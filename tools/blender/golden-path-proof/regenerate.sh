#!/usr/bin/env bash
# Regenerates the golden-path asset proof from a clean checkout.
set -euo pipefail
cd "$(dirname "$0")"
python3 build_volume.py
python3 build_scene.py
python3 render_review.py "$@"
