#!/bin/bash
set -e
MODEL="${OPENCODE_MODEL:-zhipuai-coding-plan}"
if [ -n "$OPENCODE_API_KEY" ]; then
  mkdir -p /home/opentest/.local/share/opencode 2>/dev/null || true
  jq -n --arg model "$MODEL" --arg key "$OPENCODE_API_KEY" \
    '{($model): {type: "api", key: $key}}' \
    > /home/opentest/.local/share/opencode/auth.json
fi
exec "$@"
