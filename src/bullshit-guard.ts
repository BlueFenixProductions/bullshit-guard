export function detect(text: string): string | null {
  const lower = text.toLowerCase()

  if (lower.includes('you are right')) return 'you are right'

  for (const phrase of ['great point', 'good point', 'excellent point']) {
    const i = lower.indexOf(phrase)
    if (i !== -1 && (lower.charCodeAt(i + phrase.length) || 32) < 97) return phrase
  }

  return text.match(/^Right[.!,]/im)?.[0] ?? null
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
