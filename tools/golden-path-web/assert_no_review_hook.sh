#!/usr/bin/env bash
# The review clock and its decoder probe must not exist in a shipped bundle.
#
# src/lib/golden-path-store.ts guards it on NEXT_PUBLIC_GOLDEN_REVIEW, which
# Next replaces with a literal at build time so the block is dead code. This
# checks the built chunks rather than trusting that argument.
#
#   npm run build && tools/golden-path-web/assert_no_review_hook.sh
set -euo pipefail

DIR=${1:-.next/static}

if [ ! -d "$DIR" ]; then
  echo "no build to check at $DIR - run npm run build first" >&2
  exit 2
fi

if grep -rlE "__goldenHold|__goldenDebug" "$DIR" >/dev/null 2>&1; then
  echo "FAIL: the review clock survived into the bundle:" >&2
  grep -rlE "__goldenHold|__goldenDebug" "$DIR" >&2
  exit 1
fi

echo "ok: no review clock in $DIR"
