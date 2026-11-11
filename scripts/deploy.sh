#!/usr/bin/env bash
# Manual delivery through the gh CLI. The automated path is pages.yml on every push to main;
# these run the same workflows by hand and wait for them:
#   scripts/deploy.sh validate [ref]   CI (ci.yml) on a ref, default the current branch
#   scripts/deploy.sh deploy           validate -> deploy -> verify (pages.yml) on main
#   scripts/deploy.sh verify [sha]     production serves <sha> (default origin/main) and answers
set -euo pipefail
cd "$(dirname "$0")/.."
repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"

run_and_watch() {
  local workflow="$1" ref="$2"; shift 2
  local before
  before="$(gh run list --workflow "$workflow" -L 1 --json databaseId --jq '.[0].databaseId // 0')"
  gh workflow run "$workflow" --ref "$ref" "$@"
  local id="$before"
  for _ in $(seq 1 30); do
    id="$(gh run list --workflow "$workflow" -L 1 --json databaseId --jq '.[0].databaseId // 0')"
    [ "$id" != "$before" ] && break
    sleep 2
  done
  [ "$id" = "$before" ] && { echo "deploy.sh: no new $workflow run appeared" >&2; exit 1; }
  echo "deploy.sh: $workflow run $id: https://github.com/$repo/actions/runs/$id"
  gh run watch "$id" --exit-status --interval 15
}

case "${1:-}" in
  validate)
    run_and_watch ci.yml "${2:-$(git rev-parse --abbrev-ref HEAD)}"
    ;;
  deploy)
    git fetch -q origin main
    if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
      echo "deploy.sh: deploying origin/main $(git rev-parse --short origin/main); your HEAD differs" >&2
    fi
    run_and_watch pages.yml main
    "$0" verify "$(git rev-parse origin/main)"
    ;;
  verify)
    git fetch -q origin main
    sha="${2:-$(git rev-parse origin/main)}"
    url="$(gh api "repos/$repo/pages" --jq .html_url)"
    served="$(curl -fsS "${url}revision.txt?nocache=$sha" | tr -d '[:space:]')"
    echo "deploy.sh: $url serves $served"
    [ "$served" = "$sha" ] || { echo "deploy.sh: expected $sha" >&2; exit 1; }
    for path in "" favicon.svg; do
      code="$(curl -s -o /dev/null -w '%{http_code}' "${url}${path}")"
      echo "$code ${url}${path}"
      [ "$code" = 200 ]
    done
    echo "deploy.sh: production verified"
    ;;
  *)
    echo "usage: scripts/deploy.sh validate [ref] | deploy | verify [sha]" >&2
    exit 2
    ;;
esac
