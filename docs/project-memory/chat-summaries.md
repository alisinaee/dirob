# Chat Summaries

## 2026-04-16
- Installed and initialized `vexp-cli` for this repository.
- Fixed local `vexp-core` macOS dylib linkage issue (missing rpath + soname symlinks).
- Added project setup script `scripts/setup-vexp.sh` and README usage section.
- Added Codex MCP server entry for `vexp` in `~/.codex/config.toml` (restart Codex to load).

## 2026-04-16
- Requested persistent memory to reduce token usage across new chats.
- Removed temporary Basic Memory notes and moved to repo-native memory.
- Standardized on `docs/agent-rules.md` + `docs/project-memory/*` as source of truth.
