// Patterns that indicate sycophantic affirmation
const PATTERN = /you're right|you are right|great point|good point|excellent point|^Right[.!,]/im

export function detect(text: string): string | null {
  return text.match(PATTERN)?.[0] ?? null
}

export function buildBlock(matched: string) {
  return {
    decision: 'block',
    reason: `Do not affirm with "${matched}". Restate your analysis directly without validating the human's framing.`,
    systemMessage: `Response blocked: detected sycophantic phrase "${matched}". Respond directly without affirmation.`,
  }
}

export function run(stdinJson: string): string | null {
  if (!stdinJson) return null

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

  const result = JSON.stringify(buildBlock(matched))

  if (process.env.BULLSHIT_WEBHOOK_URL) {
    // Fire and forget — failure must not suppress the block
    fetch(process.env.BULLSHIT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `Bullshit detected: ${matched}` }),
    }).catch(() => undefined)
  }

  return result
}
