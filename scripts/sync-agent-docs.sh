#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCS_FILE="docs/agent-rules.md"
UPDATER_SCRIPT="${HOME}/.codex/skills/auto-docs/scripts/update_docs.py"

CHANGE_SUMMARY=""
USER_MESSAGE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --summary)
      CHANGE_SUMMARY="${2:-}"
      shift 2
      ;;
    --user-message)
      USER_MESSAGE="${2:-}"
      shift 2
      ;;
    -h|--help)
      cat <<'EOF'
Usage: ./scripts/sync-agent-docs.sh [--summary "..."] [--user-message "..."]

Updates docs/agent-rules.md using the auto-docs updater.
Skips when there are no tracked file edits and no user-message rules to extract.
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "${UPDATER_SCRIPT}" ]]; then
  echo "Updater not found: ${UPDATER_SCRIPT}" >&2
  exit 1
fi

# Repo-tracked deltas (staged + unstaged) excluding generated memory file itself.
changed_files=()
while IFS= read -r file; do
  [[ -z "${file}" ]] && continue
  changed_files+=("${file}")
done < <(git -C "${PROJECT_ROOT}" diff --name-only HEAD -- . ':(exclude)docs/agent-rules.md')

if [[ ${#changed_files[@]} -eq 0 && -z "${USER_MESSAGE}" ]]; then
  echo "No docs sync needed: no tracked file edits and no behavior instruction."
  exit 0
fi

changed_csv=""
if [[ ${#changed_files[@]} -gt 0 ]]; then
  changed_csv="$(printf '%s,' "${changed_files[@]}")"
  changed_csv="${changed_csv%,}"
fi

python3 "${UPDATER_SCRIPT}" \
  --project-root "${PROJECT_ROOT}" \
  --docs-file "${DOCS_FILE}" \
  --changed-files "${changed_csv}" \
  --change-summary "${CHANGE_SUMMARY}" \
  --user-message "${USER_MESSAGE}"
