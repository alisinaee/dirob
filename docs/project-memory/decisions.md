# Decisions

## 2026-04-16
- Decision: Adopt `vexp` as dependency-graph context tool for token reduction.
- Rationale: Better relevance filtering than broad grep/search and reusable per-session memory graph.
- Consequence: Keep index healthy (`vexp index .`) and re-run setup helper after `vexp-cli` upgrades.

## 2026-04-16
- Decision: Use repo-native memory as the primary persistent context mechanism.
- Rationale: Versioned with code, no external dependency, easy to load in any new chat.
- Consequence: Memory quality depends on consistent concise updates after meaningful work.
