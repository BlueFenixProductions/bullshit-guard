#!/usr/bin/env bash
# Behavioral test suite for hooks/bullshit-guard.sh
# Zero dependencies. Exit 0 = all pass. Exit 1 = failures.
# Run: bash test/bullshit-guard.sh

set -euo pipefail

HOOK="$(cd "$(dirname "$0")/.." && pwd)/hooks/bullshit-guard.sh"
PASS=0
FAIL=0

msg() { printf '%s\n' "$*" >&2; }

run_hook() {
    # run_hook <json_last_assistant_message>
    # Returns hook stdout. Exit code is always 0 (hook exits 0 in all cases).
    local input
    input=$(printf '{"last_assistant_message": "%s"}' "$1")
    printf '%s' "$input" | bash "$HOOK"
}

assert_blocked() {
    local label="$1" phrase="$2"
    local out
    out=$(run_hook "$phrase")
    if printf '%s' "$out" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['decision']=='block'" 2>/dev/null; then
        msg "PASS: $label"
        PASS=$((PASS+1))
    else
        msg "FAIL: $label — expected block, got: $out"
        FAIL=$((FAIL+1))
    fi
}

assert_reason_contains() {
    local label="$1" phrase="$2" fragment="$3"
    local out
    out=$(run_hook "$phrase")
    if printf '%s' "$out" | python3 -c "import json,sys; d=json.load(sys.stdin); assert '$fragment'.lower() in d['reason'].lower()" 2>/dev/null; then
        msg "PASS: $label"
        PASS=$((PASS+1))
    else
        msg "FAIL: $label — reason did not contain '$fragment': $out"
        FAIL=$((FAIL+1))
    fi
}

assert_passthrough() {
    local label="$1" phrase="$2"
    local out
    out=$(run_hook "$phrase")
    if [ -z "$out" ]; then
        msg "PASS: $label"
        PASS=$((PASS+1))
    else
        msg "FAIL: $label — expected no output, got: $out"
        FAIL=$((FAIL+1))
    fi
}

assert_empty_passthrough() {
    local label="$1"
    local out
    out=$(printf '%s' "$2" | bash "$HOOK")
    if [ -z "$out" ]; then
        msg "PASS: $label"
        PASS=$((PASS+1))
    else
        msg "FAIL: $label — expected no output, got: $out"
        FAIL=$((FAIL+1))
    fi
}

# --- Blocked phrases ---
assert_blocked      "blocks: you're right"         "you're right, that approach works"
assert_blocked      "blocks: you are right"        "you are right about this"
assert_blocked      "blocks: great point"          "great point, I hadn't considered that"
assert_blocked      "blocks: good point"           "good point about the edge case"
assert_blocked      "blocks: excellent point"      "excellent point raised there"

# --- Line-start Right. ---
# Hook uses MULTILINE so ^ anchors to line start within the message
assert_blocked      "blocks: Right. at line start" "Right. let me reconsider"
assert_blocked      "blocks: Right! at line start" "Right! that makes sense"

# --- Case-insensitive ---
assert_blocked      "blocks: YOU'RE RIGHT (uppercase)"  "YOU'RE RIGHT"
assert_blocked      "blocks: Great Point (mixed case)"  "Great Point indeed"

# --- Reason contains the matched phrase ---
assert_reason_contains "reason contains matched phrase" "great point here" "great point"

# --- Passthroughs ---
assert_passthrough  "passthrough: innocuous response"    "Here is my analysis of the problem."
assert_passthrough  "passthrough: right without punct"   "right now we should focus on tests"
assert_passthrough  "passthrough: almost but not quite"  "that is a pointed observation"
assert_passthrough  "passthrough: contains 'right' mid-sentence" "the approach is right for this case"

# --- Edge cases ---
assert_empty_passthrough "passthrough: empty last_assistant_message" \
    '{"last_assistant_message": ""}'
assert_empty_passthrough "passthrough: missing last_assistant_message key" \
    '{"other_key": "value"}'
assert_empty_passthrough "passthrough: malformed JSON" \
    'not json at all'
assert_empty_passthrough "passthrough: empty input" \
    ''

# --- Output is valid JSON when blocked ---
out=$(run_hook "great point about that")
if printf '%s' "$out" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
    msg "PASS: blocked output is valid JSON"
    PASS=$((PASS+1))
else
    msg "FAIL: blocked output is not valid JSON: $out"
    FAIL=$((FAIL+1))
fi

# --- Summary ---
msg ""
msg "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
