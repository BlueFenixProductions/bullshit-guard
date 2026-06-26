import { detect, run } from '../src/bullshit-guard.js'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// Build a real Claude Code transcript (JSONL) whose last assistant message is `text`,
// then return the Stop-hook payload that points at it — the actual contract.
function transcriptWith(text: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'bsg-'))
  const file = join(dir, 'transcript.jsonl')
  writeFileSync(
    file,
    [
      JSON.stringify({ type: 'user', message: { role: 'user', content: 'review this' } }),
      JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } }),
    ].join('\n'),
  )
  return file
}

const payload = (text: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ transcript_path: transcriptWith(text), stop_hook_active: false, ...extra })

describe('detect', () => {
  it.each([
    'you are right about this',
    "you're right, that breaks",
    "you're absolutely right to push back",
    'great point, I had not considered that',
    'good point about the edge case',
    'excellent point raised there',
    'honestly that was a fair hit',
    'You Are Right',
    'GREAT POINT',
    'You’re Right',                 // curly apostrophe
    'you’re absolutely right',      // curly apostrophe
  ])('blocks: %s', (text) => {
    expect(detect(text)).not.toBeNull()
  })

  it.each([
    'Here is my analysis.',
    'right now we should focus on tests',
    'the approach is right for this case',
    "alright, let's go",
    '',
  ])('passes: %s', (text) => {
    expect(detect(text)).toBeNull()
  })

  // Union, not replace: a bullshit-guard.conf exists at repo root (the cwd during
  // tests) listing "great question" but NOT "fair hit". Under the old replace
  // behavior the conf would silence the defaults; union keeps both firing.
  it('keeps built-in defaults even when a conf file is present', () => {
    expect(detect('that was a fair hit')).not.toBeNull()   // default, not in conf
  })

  it('also fires on conf-only extras', () => {
    expect(detect('great question, let me think')).not.toBeNull()  // conf extra, not a default
  })
})

describe('run', () => {
  it('returns null for clean input', () => {
    expect(run(payload('Here is my analysis.'))).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(run('not json')).toBeNull()
  })

  it('returns null when transcript_path is missing', () => {
    expect(run(JSON.stringify({ stop_hook_active: false }))).toBeNull()
  })

  it('blocks and returns valid JSON', () => {
    expect(JSON.parse(run(payload('excellent point'))!).decision).toBe('block')
  })

  it('reads the LAST assistant message from the transcript', () => {
    expect(JSON.parse(run(payload("you're absolutely right"))!).decision).toBe('block')
  })

  // One shot, then stop: a retry arrives with stop_hook_active=true and must not re-block.
  it('stands down when stop_hook_active is true', () => {
    expect(run(payload('excellent point', { stop_hook_active: true }))).toBeNull()
  })

  describe('muster dispatch', () => {
    beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true })))
    afterEach(() => {
      delete process.env.BULLSHIT_WEBHOOK_URL
      delete process.env.BULLSHIT_OFFENDER
    })

    const lastCall = () => (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]

    it('does not fire when URL is unset', async () => {
      await run(payload('great point'))
      expect(fetch).not.toHaveBeenCalled()
    })

    describe('Campfire transport', () => {
      // Real once-campfire bot endpoint shape: /rooms/<id>/<bot_key>/messages (no /bot/ segment)
      const CAMPFIRE = 'https://campfire.bluefenix.net/rooms/3/2-SECRETKEY/messages'

      it('posts the rebuke as a raw HTML body (no JSON wrapper)', async () => {
        process.env.BULLSHIT_WEBHOOK_URL = CAMPFIRE
        await run(payload('fair hit'))
        const [url, init] = lastCall() as [string, RequestInit]
        expect(url).toBe(CAMPFIRE)
        expect((init.headers as Record<string, string>)['Content-Type']).toBe('text/plain')
        const body = init.body as string
        expect(body).toContain('fair hit')          // the blocked phrase, interpolated
        expect(body).toContain('@ironquill')         // plain-text handle that wakes the responder
        expect(body).not.toContain('"text"')         // NOT the Slack JSON shape
      })
    })

    describe('Slack/Discord transport', () => {
      const SLACK = 'https://hooks.slack.com/services/A/B/C'

      it('posts JSON {text} with the offender tag', async () => {
        process.env.BULLSHIT_WEBHOOK_URL = SLACK
        process.env.BULLSHIT_OFFENDER = 'europa'
        await run(payload('great point'))
        const [url, init] = lastCall() as [string, RequestInit]
        expect(url).toBe(SLACK)
        expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
        const parsed = JSON.parse(init.body as string)
        expect(parsed.text).toContain('great point')
        expect(parsed.text).toContain('europa')
      })

      it('falls back to hostname when no offender override is set', async () => {
        process.env.BULLSHIT_WEBHOOK_URL = SLACK
        await run(payload('great point'))
        const [, init] = lastCall() as [string, RequestInit]
        expect(JSON.parse(init.body as string).text).toMatch(/\[.+\] Bullshit detected/)
      })
    })

    it('still blocks if the dispatch throws', async () => {
      process.env.BULLSHIT_WEBHOOK_URL = 'https://hooks.slack.com/services/A/B/C'
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
      expect(JSON.parse((await run(payload('great point')))!).decision).toBe('block')
    })
  })
})
