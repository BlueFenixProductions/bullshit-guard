# bullshit-guard

Claude will tell you you're right when you're wrong. It will call your half-baked idea a great point. It will agree with your bad architecture and help you ship it. This is a Claude Code Stop hook that kills that response before it reaches you and makes Claude try again.

No strikes. No warnings. The nodding answer is gone. Claude gets one more shot to say something useful.

If that shot opens with "great point" — gone too. There is no bobblehead budget.

## What it catches

- `you're right` / `you are right`
- `great point` / `good point` / `excellent point`
- `right.` / `right!` at the start of a line

Add your own. The list is short because these are the ones that actually sting.

## Build

```bash
bun install
bun run build
```

Compiles `src/bullshit-guard.ts` to `hooks/bullshit-guard.js`. The `.js` is what you copy and register.

## Install

### macOS / Linux / Windows (WSL)

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

### Project-level install

Drop it in `.claude/settings.json` at your repo root instead of `~/.claude/settings.json` to scope it to a single project. Same JSON structure, same hook path.

### Codex CLI

Codex CLI uses `~/.codex/hooks.json` (or `.codex/hooks.json` at project level). The JSON structure is identical to Claude Code's. Hooks must be enabled first in `~/.codex/config.toml`:

```toml
[features]
codex_hooks = true
```

Then register the hook:

```bash
mkdir -p ~/.codex/hooks
cp hooks/bullshit-guard.js ~/.codex/hooks/bullshit-guard.js
```

Add to `~/.codex/hooks.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/.codex/hooks/bullshit-guard.js\"",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

The `decision: "block"` output contract is the same — Codex treats the reason as a continuation prompt injected as the next user message.

### Crush (charmbracelet)

Crush uses `~/.config/crush/crush.json` (or `.crush.json` at project level) and a `PreToolUse` hook — not a `Stop` hook. Its output contract is different: exit 2 to block, exit 0 with `{"decision":"allow"|"deny"}` to control tool calls. bullshit-guard's `Stop`-hook contract does not map to Crush's hook system. Source: [charmbracelet/crush docs/hooks](https://github.com/charmbracelet/crush/blob/main/docs/hooks/README.md).

### Other harnesses

The `decision: "block"` stdout contract is Claude Code-native and adopted by Codex CLI. Other harnesses (OpenClaw, Hermes Agent) have no publicly documented hook system at time of writing. If your harness honors the same stdout contract, bullshit-guard works as-is. If it doesn't, the hook exits 0 and does nothing harmful.

## Optional: designate a verbal abuse officer

Set `BULLSHIT_WEBHOOK_URL` and every blocked phrase gets POSTed there before the redo fires. Wire it to wherever the appropriate person — or bot — is waiting.

```bash
export BULLSHIT_WEBHOOK_URL=https://your-endpoint/here
```

The hook POSTs `{"text": "Bullshit detected: \"<matched>\" — response blocked and retried."}` as JSON. To customise the payload for your endpoint, edit `src/bullshit-guard.ts` and rebuild.

For message inspiration, see [`seeds/verbal-abuse.md`](seeds/verbal-abuse.md).

### Slack

Slack incoming webhooks accept `{"text": "..."}` natively. No changes needed.

```bash
export BULLSHIT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### Discord

Discord webhook URLs accept Slack-compatible payloads if you append `/slack`:

```bash
export BULLSHIT_WEBHOOK_URL=https://discord.com/api/webhooks/ID/TOKEN/slack
```

Or change the payload key from `text` to `content` in `src/bullshit-guard.ts` and use the plain webhook URL.

### Mastodon, Bluesky, X, Signal

These require auth headers, token exchanges, or OAuth that can't be expressed as a bare webhook URL. Run a thin proxy (a single Cloudflare Worker endpoint works) that accepts the hook's simple POST and handles the platform-specific auth. The hook stays dumb; the proxy handles the dance.

The block fires whether or not the webhook succeeds. Your abuse officer is optional. The block is not.

## Extend the pattern list

Edit the patterns array in `src/bullshit-guard.ts`, then `bun run build`.

The usual suspects:
```
absolutely|certainly|of course|indeed|great question|good question|totally
```

## How it works

Claude Code Stop hooks receive JSON on stdin with the session context including `last_assistant_message`. The hook inspects that field and, if it matches a bullshit pattern, writes `{"decision": "block", "reason": "..."}` to stdout and exits 0. Claude discards the response, injects the reason as context, and tries again. The original response is gone.

The `reason` tells Claude exactly what it said, why that's not acceptable, and to try again without the ass-kissing.

## License

[WTFPL](LICENSE) — do what the fuck you want to.

## Requirements

- `node` 18+
- `bun` (build only)
- No other dependencies
