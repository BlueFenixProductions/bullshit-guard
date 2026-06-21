# sycophancy-guard

Claude will tell you you're right when you're wrong. It will call your half-baked idea a great point. It will agree with your bad architecture and help you implement it. This stops that.

A Stop hook that **blocks sycophantic responses before they reach you** and forces an immediate redo. No strikes. No warnings. The nodding answer gets killed and Claude tries again.

## What it catches

- `you're right` / `you are right`
- `great point` / `good point` / `excellent point`
- `right.` / `right!` at the start of a line

If the redo opens with another blocked phrase, that gets killed too. There is no bobblehead budget.

## Install

### macOS / Linux

```bash
mkdir -p ~/.claude/hooks
cp hooks/sycophancy-guard.sh ~/.claude/hooks/sycophancy-guard.sh
chmod +x ~/.claude/hooks/sycophancy-guard.sh
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
            "command": "bash \"$HOME/.claude/hooks/sycophancy-guard.sh\"",
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
Copy-Item hooks\sycophancy-guard.ps1 "$env:USERPROFILE\.claude\hooks\sycophancy-guard.ps1"
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
            "command": "powershell.exe -NonInteractive -WindowStyle Hidden -File \"%USERPROFILE%\\.claude\\hooks\\sycophancy-guard.ps1\"",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

## Optional: route offenses somewhere useful

Set `SYCOPHANCY_WEBHOOK_URL` and every blocked phrase gets POSTed there before the redo fires. Wire it to Slack, Discord, a custom endpoint, or a very angry bot you've designated for exactly this purpose.

```bash
export SYCOPHANCY_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

Payload:
```json
{ "text": "Sycophancy detected: agent said \"great point\" — response blocked and retried." }
```

Slack webhooks accept this directly. Discord: append `/slack` to your webhook URL or swap `text` for `content`.

The block fires whether or not the webhook call succeeds.

## Extending the pattern list

Edit the `re.compile(...)` line in `sycophancy-guard.sh` (or `[regex]::Match` in the `.ps1`). Standard Python / .NET regex, `IGNORECASE | MULTILINE`.

Suggestions:
```
absolutely|certainly|of course|indeed|great question|good question|totally
```

## How it works

Claude Code Stop hooks can return `{"decision": "block", "reason": "..."}` to discard a response and inject a correction back to the model. This hook uses that to tell Claude exactly what it said, why that's not acceptable, and to try again without the affirmation. The original response is gone.

## License

[WTFPL](LICENSE) — do what the fuck you want to.

## Requirements

- macOS/Linux: `python3`, `curl` (pre-installed everywhere that matters)
- Windows: PowerShell 5.1+
- No other dependencies
