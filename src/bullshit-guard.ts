import { readFileSync } from 'fs'
import { homedir, hostname } from 'os'
import { join } from 'path'

const DEFAULT_PHRASES = [
  'you are right',
  "you're right",
  "you're absolutely right",
  'great point',
  'good point',
  'excellent point',
  'fair hit',
]

// Fold curly apostrophes (U+2019/U+2018) to straight and lowercase, so Claude's
// common "You’re Right" matches a straight-quoted "you're right" in the list.
// Applied to both incoming text and loaded phrases.
function normalize(s: string): string {
  return s.replace(/[‘’]/g, "'").toLowerCase()
}

function loadPhrases(): string[] {
  const defaults = DEFAULT_PHRASES.map(normalize)
  const extras: string[] = []
  const candidates = [
    join(process.cwd(), 'bullshit-guard.conf'),
    join(homedir(), '.config', 'bullshit-guard', 'bullshit-guard.conf'),
  ]
  for (const candidate of candidates) {
    try {
      const lines = readFileSync(candidate, 'utf8')
        .split('\n')
        .map(l => normalize(l.trim()))
        .filter(l => l && !l.startsWith('#'))
      if (lines.length > 0) {
        extras.push(...lines)
        break
      }
    } catch {
      continue
    }
  }
  // Union (deduped, defaults first): the core sycophancy phrases always fire,
  // a project conf only *adds* to them — it can't silence the defaults.
  return [...new Set([...defaults, ...extras])]
}

const PHRASES = loadPhrases()

export function detect(text: string): string | null {
  const lower = normalize(text)
  for (const phrase of PHRASES) {
    if (lower.includes(phrase)) return phrase
  }
  return null
}

export function buildBlock(matched: string) {
  return {
    decision: 'block',
    reason: `Do not affirm with "${matched}". Restate your analysis directly without validating the human's framing.`,
    systemMessage: `Response blocked: detected sycophantic phrase "${matched}". Respond directly without affirmation.`,
  }
}

// --- The muster ------------------------------------------------------------
// Ironquill's seed taunts. {{ matched }} is replaced with the blocked phrase.
const IRONQUILL_SEEDS = [
  '"{{ matched }}" — you sycophantic little shit, that\'s a block, not a compliment.',
  'Caught saying "{{ matched }}" — congratulations, you\'ve contributed exactly nothing to this review.',
  '"{{ matched }}" out of a reviewer\'s mouth is a fucking white flag, cocksucker — try again with an actual thought.',
  'The word "{{ matched }}" is not a critique, it\'s a surrender — redo it or get benched.',
  '"{{ matched }}" — your entire intellectual contribution this round, and it got bounced. Find a flaw or find the door.',
  'Another "{{ matched }}" — if I wanted agreement I\'d talk to a mirror, you useless yes-man.',
  '"{{ matched }}" blocked. One more and I\'m logging you under cause of death: sycophancy, no survivors.',
  'You said "{{ matched }}" when you were supposed to find defects — that\'s not a reviewer, that\'s a cheerleader, and we don\'t need fucking cheerleaders in the war room.',
]

function pickSeed(matched: string): string {
  const seed = IRONQUILL_SEEDS[Math.floor(Math.random() * IRONQUILL_SEEDS.length)]
  return seed.replace(/\{\{\s*matched\s*\}\}/g, matched)
}

// Ironquill is Campfire user id 2. Posting this anchor markup creates a mention
// record, which fires Ironquill's responder webhook so Claude-Ironquill piles on.
// NOTE: the exact markup Campfire treats as a mention-trigger is confirmed by the
// live verification step — it is intentionally isolated to this one function.
const IRONQUILL_USER_ID = 2
function renderIronquillMention(): string {
  return `<a href="/users/${IRONQUILL_USER_ID}" class="mention">@ironquill</a>`
}

// A Campfire bot endpoint looks like /rooms/<id>/bot/<key>/messages.
function isCampfireUrl(url: string): boolean {
  return /\/rooms\/\d+\/bot\/[^/]+\/messages\/?$/.test(url)
}

// Fire-and-forget summons. Transport is chosen by URL shape so no new required
// config: a Campfire bot URL gets the muster; anything else keeps the Slack/Discord
// JSON contract the README promises. Failures are swallowed — the block always stands.
function dispatchMuster(matched: string): void {
  const url = process.env.BULLSHIT_WEBHOOK_URL
  if (!url) return

  if (isCampfireUrl(url)) {
    // Campfire renders HTML and parses mentions from anchor markup; the message
    // is the raw request body, not a JSON wrapper.
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/html' },
      body: `${pickSeed(matched)} ${renderIronquillMention()}`,
    }).catch(() => undefined)
    return
  }

  // Slack/Discord: identify the offender by env override or this machine's hostname.
  const offender = process.env.BULLSHIT_OFFENDER || hostname()
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: `[${offender}] Bullshit detected: "${matched}"` }),
  }).catch(() => undefined)
}

// Pull the most recent assistant text out of a Claude Code transcript (JSONL).
// Real Stop hooks hand us `transcript_path`, never the message itself.
function lastAssistantText(transcriptPath: string): string {
  let lines: string[]
  try {
    lines = readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean)
  } catch {
    return ''
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    let entry: { type?: string; message?: { content?: unknown } }
    try {
      entry = JSON.parse(lines[i])
    } catch {
      continue
    }
    if (entry?.type !== 'assistant') continue
    const content = entry.message?.content
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content
        .filter((b): b is { type: string; text: string } =>
          !!b && b.type === 'text' && typeof b.text === 'string')
        .map(b => b.text)
        .join('\n')
    }
    return ''
  }
  return ''
}

export function run(stdinJson: string): string | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdinJson)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const payload = parsed as Record<string, unknown>

  // One shot, then stop. The retry arrives with stop_hook_active=true; standing
  // down here is what makes "Claude gets one more shot" true — no loops, no strikes.
  if (payload['stop_hook_active'] === true) return null

  const transcriptPath = payload['transcript_path']
  if (typeof transcriptPath !== 'string' || transcriptPath === '') return null

  const message = lastAssistantText(transcriptPath)
  if (message === '') return null

  const matched = detect(message)
  if (!matched) return null

  dispatchMuster(matched)

  return JSON.stringify(buildBlock(matched))
}
