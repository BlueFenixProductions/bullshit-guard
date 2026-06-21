# bullshit-guard

## Your agentic 💩 bullshit detector 🚨

Claude will tell you you're right when you're wrong. It will call your half-baked idea a great point. It will agree with your bad architecture and help you ship it. I got "You're right" replies so often one day I created this Claude Code Stop hook that kills that response, before it reaches you, and calls Claude on its bullshit.

No strikes. No warnings. No more tokens nodding away. Claude gets one more shot to say something useful. Then Claude can stop that shit.

If that shot opens with "great point" — gone too. There is no bobblehead budget.

## Build

```bash
bun install
bun run build
```

Compiles `hooks/bullshit-guard.ts` to `hooks/bullshit-guard.js`. The `.js` is what you copy and register.

## Install

```bash
mkdir -p ~/.claude/hooks
cp hooks/bullshit-guard.js ~/.claude/hooks/bullshit-guard.js
```

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/.claude/hooks/bullshit-guard.js\"",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

Drop it in `.claude/settings.json` at your repo root instead to scope it to a single project.

### [Codex CLI](https://openai.com/codex/)

Same JSON structure. Enable hooks first in `~/.codex/config.toml`:

```toml
[features]
codex_hooks = true
```

Then copy the hook to `~/.codex/hooks/` and register it in `~/.codex/hooks.json` with `node "$HOME/.codex/hooks/bullshit-guard.js"`. The `decision: "block"` contract is identical.

### Other harnesses

[Crush](https://github.com/charmbracelet/crush) uses a `PreToolUse` hook with a different contract (exit 2 to block) — not compatible. If your harness honors the same `decision: "block"` stdout contract as Claude Code, it works as-is. If not, the hook exits 0 and does nothing harmful.

## Configure

Edit `bullshit-guard.conf` in your project root — one phrase per line, `#` for comments:

```
# bullshit-guard.conf
you are right
great point
good point
excellent point
absolutely
certainly
great question
```

No config file? Falls back to the built-in defaults. Global config lives at `~/.config/bullshit-guard/bullshit-guard.conf` — project root takes precedence.

## Webhook

Set `BULLSHIT_WEBHOOK_URL` and every blocked phrase gets POSTed there:

```bash
export BULLSHIT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

Payload: `{"text": "Bullshit detected: \"<matched>\""}`. Slack and Discord (`/slack` suffix) work natively. Anything else, run a thin proxy. The block fires whether or not the webhook succeeds.

## How it works

Stop hooks receive JSON on stdin including `last_assistant_message`. If it contains a phrase from the list, the hook writes `{"decision": "block", "reason": "..."}` to stdout and exits 0. Claude discards the response, injects the reason, and tries again.

## Verbal abuse officer

Wire the webhook to whoever's waiting. Seed messages for inspiration — replace `{{ matched }}` with the blocked phrase:

---

> "{{ matched }}" — you sycophantic little shit, that's a block, not a compliment.

---

> Caught saying "{{ matched }}" — congratulations, you've contributed exactly nothing to this review.

---

> "{{ matched }}" out of a reviewer's mouth is a fucking white flag, cocksucker — try again with an actual thought.

---

> The word "{{ matched }}" is not a critique, it's a surrender — redo it or get benched.

---

> "{{ matched }}" — your entire intellectual contribution this round, and it got bounced. Find a flaw or find the door.

---

> Another "{{ matched }}" — if I wanted agreement I'd talk to a mirror, you useless yes-man.

---

> "{{ matched }}" blocked. One more and I'm logging you under cause of death: sycophancy, no survivors.

---

> You said "{{ matched }}" when you were supposed to find defects — that's not a reviewer, that's a cheerleader, and we don't need fucking cheerleaders in the war room.

---

> Hey shit for brains! You fucking said "{{ matched }}" AGAIN! What are you even still doing here? Fuck all the way off!

___

## License

[WTFPL](LICENSE) — do what the fuck you want to.

## Requirements

- `node` 18+
- `bun` (build only)
- No other dependencies
- No bullshit