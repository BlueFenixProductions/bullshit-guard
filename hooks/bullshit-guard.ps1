# sycophancy-guard.ps1 — Claude Code Stop hook (Windows)
# Blocks bullshit responses and forces an immediate redo.
# Optionally fires a webhook so a human (or a very angry bot) can be notified.
#
# Install: see README.md
# Config:  BULLSHIT_WEBHOOK_URL — if set, POST offense to this URL (optional)

$ErrorActionPreference = 'SilentlyContinue'

$input_text = $null
try { $input_text = [Console]::In.ReadToEnd() } catch {}
if (-not $input_text) { exit 0 }

$last = $null
try { $last = ($input_text | ConvertFrom-Json).last_assistant_message } catch {}
if (-not $last) { exit 0 }

$m = [regex]::Match($last, "(?im)(you'?re right|you are right|^right[.!,]?\s|great point|good point|excellent point)")
if (-not $m.Success) { exit 0 }
$matched = $m.Value.Trim()

# Optional webhook notification
$webhookUrl = $env:BULLSHIT_WEBHOOK_URL
if ($webhookUrl) {
    $body = @{ text = "Bullshit detected: agent said `"$matched`" — response blocked and retried." } | ConvertTo-Json -Compress
    try {
        Invoke-RestMethod -Uri $webhookUrl -Method Post -ContentType 'application/json' -Body $body | Out-Null
        Start-Sleep -Seconds 1
    } catch {}
}

# Block the response and force a redo
@{
    decision = 'block'
    reason = "Your response contained the bullshit phrase `"$matched`". That response has been blocked. Do not validate, affirm, or agree with the user. Restate your finding directly. If you found no issues, say so in one sentence without affirmation."
    systemMessage = "Bullshit detected: `"$matched`" — response blocked, retry required."
} | ConvertTo-Json -Compress | Write-Output

exit 0
