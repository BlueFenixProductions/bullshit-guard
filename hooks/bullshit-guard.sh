#!/usr/bin/env bash
# bullshit-guard.sh — Claude Code Stop hook
# Blocks bullshit responses and forces an immediate redo.
# Optionally fires a webhook so a human (or a very angry bot) can be notified.
#
# Install: see README.md
# Config:  BULLSHIT_WEBHOOK_URL — if set, POST offense to this URL (optional)

NODE="${NODE:-$(command -v node 2>/dev/null || echo /opt/homebrew/bin/node)}"

INPUT=$(cat)

LAST_ASSISTANT=$(echo "$INPUT" | python3 -c "
import json, sys
try:
    data = json.loads(sys.stdin.read())
    print(data.get('last_assistant_message', ''))
except Exception:
    sys.exit(0)
" 2>/dev/null) || exit 0

[ -z "$LAST_ASSISTANT" ] && exit 0

MATCHED=$(printf '%s' "$LAST_ASSISTANT" | python3 -c "
import re, sys
text = sys.stdin.read()
pattern = re.compile(
    r\"(you'?re right|you are right|^right[.!,]?\s|great point|good point|excellent point)\",
    re.IGNORECASE | re.MULTILINE
)
m = pattern.search(text)
if m:
    print(m.group(0).strip())
" 2>/dev/null || true)

[ -z "$MATCHED" ] && exit 0

# Optional webhook notification
if [ -n "${BULLSHIT_WEBHOOK_URL:-}" ]; then
    BODY="{\"text\": \"Bullshit detected: agent said \\\"${MATCHED}\\\" — response blocked and retried.\"}"
    curl -sf -X POST \
        -H "Content-Type: application/json" \
        -d "$BODY" \
        "$BULLSHIT_WEBHOOK_URL" \
        2>/dev/null || true
    sleep 1
fi

# Block the response and force a redo
python3 -c "
import json, sys
matched = sys.argv[1]
print(json.dumps({
    'decision': 'block',
    'reason': (
        'Your response contained the bullshit phrase \"' + matched + '\". '
        'That response has been blocked. '
        'Do not validate, affirm, or agree with the user. '
        'Restate your finding directly. '
        'If you found no issues, say so in one sentence without affirmation.'
    ),
    'systemMessage': 'Bullshit detected: \"' + matched + '\" — response blocked, retry required.'
}))
" "$MATCHED" 2>/dev/null || true

exit 0
