import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const DEFAULT_PHRASES = [
  'you are right',
  'great point',
  'good point',
  'excellent point',
]

function loadPhrases(): string[] {
  const candidates = [
    join(process.cwd(), 'bullshit-guard.conf'),
    join(homedir(), '.config', 'bullshit-guard', 'bullshit-guard.conf'),
  ]
  for (const candidate of candidates) {
    try {
      const lines = readFileSync(candidate, 'utf8')
        .split('\n')
        .map(l => l.trim().toLowerCase())
        .filter(l => l && !l.startsWith('#'))
      if (lines.length > 0) return lines
    } catch {
      continue
    }
  }
  return DEFAULT_PHRASES
}

const PHRASES = loadPhrases()

export function detect(text: string): string | null {
  const lower = text.toLowerCase()
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

export function run(stdinJson: string): string | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdinJson)
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null) return null

  const message = (parsed as Record<string, unknown>)['last_assistant_message']
  if (typeof message !== 'string' || message === '') return null

  const matched = detect(message)
  if (!matched) return null

  if (process.env.BULLSHIT_WEBHOOK_URL) {
    // Fire and forget — failure must not suppress the block
    fetch(process.env.BULLSHIT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `Bullshit detected: ${matched}` }),
    }).catch(() => undefined)
  }

  return JSON.stringify(buildBlock(matched))
}
