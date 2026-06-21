# bullshit-guard

Claude will tell you you're right when you're wrong. It will call your half-baked idea a great point. It will agree with your bad architecture and help you ship it. This is a Claude Code Stop hook that kills that response before it reaches you and makes Claude try again.

No strikes. No warnings. The nodding answer is gone. Claude gets one more shot to say something useful.

If that shot opens with "great point" — gone too. There is no bobblehead budget.

## What it catches

- `you're right` / `you are right`
- `great point` / `good point` / `excellent point`
- `right.` / `right!` at the start of a line

Add your own. The list is short because these are the ones that actually sting.

## Install

### macOS / Linux

```bash
mkdir -p ~/.claude/hooks
cp hooks/bullshit-guard.sh ~/.claude/hooks/bullshit-guard.sh
chmod +x ~/.claude/hooks/bullshit-guard.sh
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
            "command": "bash \"$HOME/.claude/hooks/bullshit-guard.sh\"",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

### Windows

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\hooks"
Copy-Item hooks\bullshit-guard.ps1 "$env:USERPROFILE\.claude\hooks\bullshit-guard.ps1"
```

Add to `%USERPROFILE%\.claude\settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "powershell.exe -NonInteractive -WindowStyle Hidden -File \"%USERPROFILE%\\.claude\\hooks\\bullshit-guard.ps1\"",
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

### Other harnesses (Codex, OpenCode, OpenClaw, etc.)

Harnesses that use `.agents/` instead of `.claude/` follow the same pattern — copy the hook, register it in `.agents/settings.json` with the same JSON structure. Replace `~/.claude/hooks/` with `~/.agents/hooks/` (or the equivalent your harness expects) throughout.

## Optional: designate a verbal abuse officer

Set `BULLSHIT_WEBHOOK_URL` and every blocked phrase gets POSTed there before the redo fires. Wire it to wherever the appropriate person — or bot — is waiting.

```bash
export BULLSHIT_WEBHOOK_URL=https://your-endpoint/here
```

### Slack

```bash
export BULLSHIT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

Payload (`{"text": "..."}`) works natively with Slack incoming webhooks. No extra config.

### Discord

```bash
export BULLSHIT_WEBHOOK_URL=https://discord.com/api/webhooks/ID/TOKEN
```

Discord expects `content` not `text`. Edit the hook script and swap:
```bash
BODY="{\"content\": \"Bullshit detected: agent said \\\"${MATCHED}\\\" — response blocked and retried.\"}"
```

Or append `/slack` to your Discord webhook URL and leave the script as-is.

### Mastodon

```bash
export BULLSHIT_WEBHOOK_URL=https://your.instance/api/v1/statuses
```

Mastodon needs a Bearer token. Edit the curl call in the hook to add the header:
```bash
curl -sf -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d "{\"status\": \"Bullshit detected: agent said \\\"${MATCHED}\\\" — response blocked.\"}" \
  "$BULLSHIT_WEBHOOK_URL" 2>/dev/null || true
```

### Bluesky

Bluesky requires an app password and a session token exchange before posting. Wire up a small proxy (a single-endpoint Cloudflare Worker or similar) that holds your credentials and accepts the same simple POST the hook fires. The hook stays dumb; the proxy handles the AT Protocol dance.

### X (Twitter)

X's API requires OAuth 2.0 and a paid developer account. Same proxy approach as Bluesky — keep the hook simple, put the auth complexity in a thin intermediary.

### Signal

Requires [`signal-cli`](https://github.com/AsamK/signal-cli) running locally. Replace the curl call with:
```bash
signal-cli -u +15551234567 send -m "Bullshit detected: \"${MATCHED}\" — response blocked." +15559876543
```

The block fires whether or not the webhook succeeds. Your abuse officer is optional. The block is not.

## Extend the pattern list

Edit `re.compile(...)` in `bullshit-guard.sh` or `[regex]::Match` in the `.ps1`. Python / .NET regex, `IGNORECASE | MULTILINE`.

The usual suspects:
```
absolutely|certainly|of course|indeed|great question|good question|totally
```

## How it works

Claude Code Stop hooks can return `{"decision": "block", "reason": "..."}` to throw away a response and inject a correction. This hook uses that to tell Claude what it said, why that's not acceptable, and to try again without the ass-kissing. The original response is discarded.

## License

[WTFPL](LICENSE) — do what the fuck you want to.

## Requirements

- macOS/Linux: `python3`, `curl`
- Windows: PowerShell 5.1+
- No other dependencies
