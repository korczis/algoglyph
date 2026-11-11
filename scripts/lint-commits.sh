#!/usr/bin/env bash
# Conventional Commits check, shared by the commit-msg hook and CI.
#   lint-commits.sh --file <msg-file>      one message (the hook)
#   lint-commits.sh --range <a>..<b>       every commit in a range (CI)
set -euo pipefail
PATTERN='^(feat|fix|perf|refactor|docs|style|test|build|ci|chore|revert)(\([a-z0-9._/-]+\))?!?: .{1,100}$'

check() {
  local subject="$1" where="$2"
  case "$subject" in
    Merge\ *|Revert\ *|fixup!\ *|squash!\ *) return 0 ;;
  esac
  if ! printf '%s' "$subject" | grep -Eq "$PATTERN"; then
    echo "lint-commits: $where: not a Conventional Commit subject: $subject" >&2
    echo "  expected: type(scope): description   (types: feat fix perf refactor docs style test build ci chore revert)" >&2
    return 1
  fi
}

case "${1:-}" in
  --file)
    check "$(grep -v '^#' "$2" | head -n 1)" "message"
    ;;
  --range)
    status=0
    while read -r sha; do
      check "$(git log -1 --format=%s "$sha")" "${sha:0:12}" || status=1
    done < <(git rev-list --no-merges "$2")
    exit $status
    ;;
  *)
    echo "usage: lint-commits.sh --file <msg> | --range <a>..<b>" >&2
    exit 2
    ;;
esac
