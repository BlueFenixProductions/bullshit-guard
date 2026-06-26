# Righting the *Yarmouth*: bullshit-guard → Campfire muster + plugin

**Date:** 2026-06-26
**Status:** Approved (design); pending spec review
**Author:** Commander (for Captain Chris Pelatari)

## Problem

`bullshit-guard` is a Claude Code `Stop` hook that blocks sycophantic phrases. Four
orders from the Captain:

1. Ban additional phrases — `you're right`, `you're absolutely right`, `fair hit` —
   via substring match, and ensure all triggers actually fire.
2. Make the muster real: the offending crewman must be summoned to Campfire and
   receive a rebuke from `@ironquill`.
3. Ship it as a real Claude Code plugin installable on the crew's machines.
4. A runbook so the crew can install it.

## Verified environment (inventory, not assumption)

This host is `madara` (Debian). Infra confirmed live via Docker/Coolify/Tailscale and
the Campfire database — not inferred from the repo.

| Component | Reality |
|---|---|
| Campfire | `once-campfire` Rails app (Coolify service `campfire`, container `lu7…`) at `campfire.bluefenix.net`. Has a bot API. |
| Other apps | `fizzy.bluefenix.net` (`basecamp/fizzy`) and `topo.bluefenix.net` (nginx) are **separate** apps, unrelated to the muster. |
| Muster room | Campfire room **#3 `muster`** (`Rooms::Open`). |
| Poster bot | `muster-console` (user id 4, bot, member of rooms 1/2/3). |
| Ironquill | Campfire bot (user id 2), member of rooms 1/2/3/4. Its mention-webhook → `http://100.70.94.58:8788/campfire/ironquill?token=…`. |
| Ironquill's brain | The responder at `100.70.94.58:8788` = **itachi** (macOS) — a Cloudflare-Pages/wrangler-style service on Itachi's Mac. Backs `ironquill`, `rikudo`, `hinata`. Source lives on Itachi, **not** on Madara. |
| Crew bots | `itachi` (id 7) and `europa` (id 8) are members carrying their **own bot_tokens** (per-machine poster identities). `rikudo` (id 5) and `hinata` (id 6) are bots with responder webhooks. |
| Crew machines (Tailscale) | `itachi` = macOS, `hinata` = macOS, `europa` = Windows 11, `rikudo` = **Debian Trixie (Debian 13)**, `madara` = Debian (this host). |

**Secrets:** the shared webhook token, `muster-console`/`ironquill`/crew bot_tokens are
the Captain's secrets. They live in env vars / Bitwarden. **Never commit them to git.**

### How the muster flows

```
 Dev machine (e.g. Europa)                  Campfire (Madara) room #3 "muster"
 ┌─────────────────────────┐  POST raw text  ┌──────────────────────────────────────┐
 │ bullshit-guard Stop hook │ ──────────────► │ posts AS that crew bot:              │
 │ blocks "fair hit" etc.   │ /rooms/3/bot/   │  "<rebuke>"  + @ironquill mention    │
 └─────────────────────────┘ <crewKey>/      │            │ mention fires webhook    │
                              messages        └────────────┼─────────────────────────┘
                                                           ▼  http://itachi:8788/campfire/ironquill
                                              Claude-backed Ironquill → posts fresh ire into #3
```

## Design

### Order 1 — Phrase detection (`src/bullshit-guard.ts`)

- **New default phrases** added to `DEFAULT_PHRASES` and the shipped `bullshit-guard.conf`:
  `you're right`, `you're absolutely right`, `fair hit`. Listed separately — substring
  layering means `you're absolutely right` does **not** contain `you're right`.
- **Apostrophe normalization:** before matching, replace curly apostrophes (`’`, U+2019)
  with straight `'` in *both* the incoming text and loaded phrases. Without this,
  Claude's common `you’re right` evades a straight-quote phrase. Implement as a small
  `normalize(s)` helper applied in `detect()` and in `loadPhrases()`.
- **Union, not replace:** `loadPhrases()` currently returns conf lines *instead of*
  defaults. Change to return the **union** (deduped, order: defaults first then conf
  extras) so the core sycophancy phrases always fire regardless of a project's conf.
  - Interface unchanged: still returns `string[]`. Callers unaffected.

### Order 2 — The muster (`src/bullshit-guard.ts`)

Replace the single Slack-shaped POST with a small dispatch that picks transport by URL shape.

- **Transport selection (no new required config):**
  - If `BULLSHIT_WEBHOOK_URL` matches the Campfire bot pattern
    (`/rooms/<id>/bot/<key>/messages`), use **Campfire transport**: `POST` with the
    message as the **raw request body**, `Content-Type: text/html` (Campfire renders
    HTML and parses mentions from anchor markup).
  - Otherwise, use the existing **Slack/Discord transport**: `POST {"text": …}` JSON.
    Preserves the README's existing promise.
- **Message content (hybrid):** the posted body =
  1. one Ironquill seed line from `seeds/verbal-abuse.md` (the 8 seeds become a baked-in
     array constant), rotated/varied per call, with `{{ matched }}` → the blocked phrase; **plus**
  2. an `@ironquill` mention rendered as Campfire mention markup so Campfire fires
     Ironquill's responder webhook → Claude-Ironquill piles on with fresh ire.
  - The exact mention markup (anchor to `/users/2` vs. plain `@ironquill`) must be
    **verified empirically** against the live instance (see Verification). The code
    centralizes mention rendering in one function so it's a one-line change once confirmed.
- **Per-machine crew-bot identity:** the poster identity is entirely determined by the
  bot URL+token in that machine's `BULLSHIT_WEBHOOK_URL`. Itachi's box uses the `itachi`
  bot URL, Europa's the `europa` bot URL, etc. → the offender is identified automatically
  by *which* bot posts. No separate offender env var is required for Campfire.
  - For the Slack transport (no per-machine identity), an optional `BULLSHIT_OFFENDER`
    env var (fallback: OS hostname) is prepended to the text. Campfire transport ignores it.
- **Contract preserved:** dispatch is fire-and-forget; the block is returned whether or
  not the POST succeeds. Failures are swallowed (`.catch`).

### Order 3 — Real Claude Code plugin

Add, without breaking the existing manual-install path:

- `.claude-plugin/plugin.json` — `name: bullshit-guard`, `version`, `description`, author, license.
- `hooks/hooks.json` — registers the `Stop` hook:
  `node "${CLAUDE_PLUGIN_ROOT}/hooks/bullshit-guard.js"`, `timeout: 15`.
  `${CLAUDE_PLUGIN_ROOT}` resolves cross-platform (Win/macOS/Linux).
- `.claude-plugin/marketplace.json` — single-plugin marketplace pointing at this repo,
  so the crew runs:
  - `/plugin marketplace add BlueFenixProductions/bullshit-guard`
  - `/plugin install bullshit-guard`
- **Commit the built `hooks/bullshit-guard.js`** (currently gitignored) so installers need
  only Node, not Bun. Update `.gitignore` accordingly. Build step (`bun run build`) stays
  for development.

### Order 4 — Cross-platform runbook (`RUNBOOK.md`)

One document, three lanes; each crewman picks theirs:

- **Shared prereqs:** Node 18+ on PATH; the machine on Tailscale and able to reach
  `campfire.bluefenix.net`; that machine's crew-bot URL+token (from Bitwarden).
- **Lane A — Windows 11** (europa): `winget install OpenJS.NodeJS.LTS`, PowerShell,
  `/plugin` install, set `BULLSHIT_WEBHOOK_URL` via `setx`.
- **Lane B — macOS** (itachi, hinata): Homebrew/nvm Node, `/plugin` install,
  `export` in shell profile.
- **Lane C — Debian** incl. **Trixie / Debian 13** (rikudo, madara): apt/nvm Node,
  `/plugin` install, `export` in `~/.bashrc`. Call out any Trixie-specific Node notes.
- **Per-crewman crew-bot mapping** table (which bot URL each machine uses).
- **Note:** `rikudo` is a Debian Trixie machine (now in scope); responder-only personas
  need no install on the responder host beyond their own box.
- **Fire a test shot:** say a banned phrase in Claude Code → confirm (a) the response is
  blocked, (b) a summons appears in #muster as the crew bot, (c) Ironquill replies.

### Order 4 (cont.) — The interview

Conducted; all forks resolved and recorded above. No open questions remain.

## Testing (`test/bullshit-guard.test.ts`)

- New phrases block: `you're right`, `you're absolutely right`, `fair hit` (+ within sentences).
- Curly apostrophe blocks: `you’re right`, `you’re absolutely right`.
- Union: a conf with only custom phrases still blocks the built-in defaults.
- Campfire transport: URL matching `/rooms/3/bot/KEY/messages` → POST with raw body
  (not JSON), body contains the rebuke text and the `@ironquill` mention; assert no
  `{"text":…}` wrapper.
- Slack transport: non-Campfire URL → POST `{"text":…}` JSON (existing behavior intact).
- Offender tag (Slack only): `BULLSHIT_OFFENDER` / hostname appears in JSON text.
- Block still returned when the POST rejects (existing test extended per transport).

`bun run test` and `bun run typecheck` green = done.

## Verification (requires Captain's explicit go-ahead — outward action)

Fire one real test message into live room #3 `muster` (as a crew bot) to confirm:
the Campfire bot POST shape, the `@ironquill` mention markup that actually triggers the
responder, and Ironquill's reply. This sends a message into the Captain's chat, so it is
**not** performed without explicit approval.

## Out of scope (YAGNI)

- Strike counters / persistence / cooldowns.
- TTS or any local audio.
- Per-crew separate rooms (single shared #muster).
- Standing up new Campfire bots (itachi/europa tokens exist; rikudo/hinata/madara poster
  tokens are distributed, not created here).
- Modifying Ironquill's responder on Itachi (separate codebase, separate host).

## Risks / open verifications

- **Mention markup:** Campfire mention-trigger format is verified empirically before the
  Campfire transport is considered done. Centralized in one render function.
- **Secret distribution:** bot tokens must reach each machine's env without entering git;
  runbook directs crew to Bitwarden.
