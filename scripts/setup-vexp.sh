#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v vexp >/dev/null 2>&1; then
  npm install -g vexp-cli
fi

NPM_GLOBAL_ROOT="$(npm root -g)"
BIN_DIR="$NPM_GLOBAL_ROOT/vexp-cli/node_modules/@vexp/core-darwin-arm64/bin"

if [ -d "$BIN_DIR" ]; then
  ln -sf libggml-base.0.9.11.dylib "$BIN_DIR/libggml-base.0.dylib" || true
  ln -sf libggml.0.9.11.dylib "$BIN_DIR/libggml.0.dylib" || true
  ln -sf libllama.0.0.1.dylib "$BIN_DIR/libllama.0.dylib" || true
  install_name_tool -add_rpath @executable_path "$BIN_DIR/vexp-core" >/dev/null 2>&1 || true
fi

cd "$PROJECT_ROOT"
vexp init . >/dev/null 2>&1 || true
vexp index .

echo "vexp setup complete for $PROJECT_ROOT"
echo "Try: vexp capsule \"top reload side panel refresh\" --max-tokens 1800"
