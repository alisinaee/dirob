#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCS_PATH="${PROJECT_ROOT}/docs/agent-rules.md"

if [[ ! -f "${DOCS_PATH}" ]]; then
  echo "Missing docs/agent-rules.md. Bootstrapping now..."
  "${PROJECT_ROOT}/scripts/sync-agent-docs.sh" \
    --summary "Bootstrapped docs before agent preflight read."
fi

echo "Reading agent context: ${DOCS_PATH}"
echo

awk '
  /^## Project Snapshot$/ {print; in_snapshot=1; in_rules=0; in_updated=0; next}
  /^## Behavior Rules$/ {print ""; print; in_snapshot=0; in_rules=1; in_updated=0; next}
  /^## Last Updated$/ {print ""; print; in_snapshot=0; in_rules=0; in_updated=1; next}
  /^## / {in_snapshot=0; in_rules=0; in_updated=0}
  in_snapshot || in_rules || in_updated {print}
' "${DOCS_PATH}"

