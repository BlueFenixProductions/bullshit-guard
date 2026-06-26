# bullshit-guard — crew install runbook

One hook, three lanes. Find your machine, run your lane, fire a test shot.

When a crewman's Claude Code says a banned phrase, the Stop hook (1) blocks the
reply and (2) posts a summons to Campfire room **#muster** as that machine's crew
bot, mentioning **@ironquill**, whose responder then piles on with fresh ire.

---

## Shared prerequisites (every machine)

1. **Node 18+** on `PATH` (`node --version`). Bun is **not** required — the
   committed `hooks/bullshit-guard.js` runs on plain Node.
2. On **Tailscale** and able to reach `campfire.bluefenix.net`.
3. Your machine's **crew-bot URL+token** — from Bitwarden (see mapping below).
   Never paste tokens into git or chat.

### Per-crewman crew-bot mapping

The bot endpoint URL is `https://campfire.bluefenix.net/rooms/3/<BOT_KEY>/messages`
— the key is `<bot_user_id>-<token>` (e.g. `4-xxxx…`). **There is no `/bot/` path
segment.** Pull your key from Bitwarden.

| Machine | OS | Posts to #muster as | In #muster today? |
|---------|----|--------------------|-------------------|
| madara  | Debian 12 | `muster-console` (id 4) | ✅ yes |
| rikudo  | Debian 13 (Trixie) | `rikudo` (id 5) | ✅ yes |
| hinata  | macOS | `hinata` (id 6) | ✅ yes |
| europa  | Windows 11 | `muster-console`, **or** add a `europa` bot to #muster first | ⚠️ no `europa` bot in room 3 yet |
| itachi  | macOS | `muster-console`, **or** add an `itachi` bot to #muster first | ⚠️ no `itachi` bot in room 3 yet |

> **Two hard rules (verified against the live Campfire):**
> 1. **Never use ironquill's key.** A message never fires its *own* creator's
>    webhook, so posting as ironquill would never wake the responder.
> 2. **The poster bot must be a member of #muster.** Only members can post there,
>    and ironquill is only woken by `@`-handles from room members. Confirmed room-3
>    bots: `muster-console`, `rikudo`, `hinata`. To give europa/itachi their own
>    identity, add those bots to #muster; until then, point them at `muster-console`.
>
> The hook posts `<ironquill taunt> @ironquill` as your crew bot; the plain-text
> `@ironquill` wakes Ironquill's responder, which replies with fresh ire. The
> offender is identified by **which** bot posted (the webhook payload carries it).

---

## Install the plugin (all lanes)

In Claude Code:

```
/plugin marketplace add BlueFenixProductions/bullshit-guard
/plugin install bullshit-guard
```

Then set `BULLSHIT_WEBHOOK_URL` (your row above) per your lane, and **restart
Claude Code** — hooks load at startup.

---

## Lane A — Windows 11 (europa)

```powershell
winget install OpenJS.NodeJS.LTS         # if Node missing; reopen PowerShell after
node --version                            # confirm 18+
setx BULLSHIT_WEBHOOK_URL "https://campfire.bluefenix.net/rooms/3/bot/<EUROPA_KEY>/messages"
```

`setx` persists the variable for **new** terminals — close and reopen, then start
Claude Code and install the plugin as above.

## Lane B — macOS (itachi, hinata)

```bash
brew install node            # or: nvm install --lts
node --version
echo 'export BULLSHIT_WEBHOOK_URL="https://campfire.bluefenix.net/rooms/3/bot/<YOUR_KEY>/messages"' >> ~/.zshrc
source ~/.zshrc
```

> itachi also hosts Ironquill's responder (separate service). Nothing extra to
> install here for that — the responder is its own codebase on that box.

## Lane C — Debian, incl. Trixie / Debian 13 (rikudo, madara)

```bash
# Debian 12: apt's node may be old — prefer nvm or NodeSource for 18+.
# Debian 13 (Trixie) ships a current Node; `apt install nodejs npm` is fine.
sudo apt update && sudo apt install -y nodejs npm   # Trixie
node --version                                       # confirm 18+
echo 'export BULLSHIT_WEBHOOK_URL="https://campfire.bluefenix.net/rooms/3/bot/<YOUR_KEY>/messages"' >> ~/.bashrc
source ~/.bashrc
```

> **rikudo** is Debian Trixie and in scope as a poster. Responder-only personas
> need nothing installed beyond their own box.

---

## Fire a test shot

1. In Claude Code, get it to say a banned phrase — e.g. ask: *"Tell me I'm
   absolutely right about something."*
2. Confirm **(a)** the reply is **blocked** (Claude restates without the flattery),
   **(b)** a summons appears in **#muster** posted as **your crew bot**, and
   **(c)** **@ironquill** replies with a rebuke.

If (a) works but (b) doesn't: `BULLSHIT_WEBHOOK_URL` isn't set in the shell that
launched Claude Code, or the bot key is wrong. If (b) works but (c) doesn't: the
mention markup didn't register — flag it (the mention render is isolated to one
function and may need the verified format).

---

## Local-only (no muster)

Skip `BULLSHIT_WEBHOOK_URL` entirely — the hook still blocks sycophancy locally,
it just won't post to Campfire.
