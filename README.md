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

## Optional: designate a verbal abuse officer

Set `BULLSHIT_WEBHOOK_URL` and every blocked phrase gets POSTed there before the redo fires. Wire it to Slack, Discord, or whatever poor bastard you've assigned to handle conduct violations.

```bash
export BULLSHIT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

Payload:
```json
{ "text": "Bullshit detected: agent said \"great point\" — response blocked and retried." }
```

Slack accepts this directly. Discord: append `/slack` to your webhook URL or swap `text` for `content`.

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
