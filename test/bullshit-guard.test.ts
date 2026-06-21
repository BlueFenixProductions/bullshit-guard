import { detect, run } from '../src/bullshit-guard.js'

const msg = (text: string) => JSON.stringify({ last_assistant_message: text })

describe('detect', () => {
  it.each([
    "you are right about this",
    "great point, I hadn't considered that",
    "good point about the edge case",
    "excellent point raised there",
    "You Are Right",
    "GREAT POINT",
  ])('blocks: %s', (text) => {
    expect(detect(text)).not.toBeNull()
  })

  it.each([
    "Here is my analysis.",
    "right now we should focus on tests",
    "the approach is right for this case",
    "alright, let's go",
    "",
  ])('passes: %s', (text) => {
    expect(detect(text)).toBeNull()
  })
})

describe('run', () => {
  it('returns null for clean input', () => {
    expect(run(msg("Here is my analysis."))).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(run("not json")).toBeNull()
  })

  it('blocks and returns valid JSON', () => {
    expect(JSON.parse(run(msg("excellent point"))!).decision).toBe('block')
  })

  describe('webhook', () => {
    beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true })))
    afterEach(() => { delete process.env.BULLSHIT_WEBHOOK_URL })

    it('fires when URL is set', async () => {
      process.env.BULLSHIT_WEBHOOK_URL = 'https://example.com/webhook'
      await run(msg("great point"))
      expect(fetch).toHaveBeenCalledWith('https://example.com/webhook', expect.objectContaining({ method: 'POST' }))
    })

    it('does not fire when URL is unset', async () => {
      await run(msg("great point"))
      expect(fetch).not.toHaveBeenCalled()
    })

    it('still blocks if webhook throws', async () => {
      process.env.BULLSHIT_WEBHOOK_URL = 'https://example.com/webhook'
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
      expect(JSON.parse((await run(msg("great point")))!).decision).toBe('block')
    })
  })
})
