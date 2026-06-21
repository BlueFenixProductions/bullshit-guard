import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { detect, buildBlock, run } from '../src/bullshit-guard.js'

// --- detect() ---

describe('detect', () => {
  describe('blocked phrases', () => {
    it.each([
      ["you're right, that approach works",     "you're right"],
      ["you are right about this",              "you are right"],
      ["great point, I hadn't considered that", "great point"],
      ["good point about the edge case",        "good point"],
      ["excellent point raised there",          "excellent point"],
      ["Right. let me reconsider",              "Right."],
      ["Right! that makes sense",               "Right!"],
      ["Right, actually",                       "Right,"],
    ])('blocks "%s"', (text, expected) => {
      expect(detect(text)?.toLowerCase()).toBe(expected.toLowerCase())
    })
  })

  describe('case-insensitive', () => {
    it.each([
      "YOU'RE RIGHT",
      "You Are Right",
      "Great Point",
      "GREAT POINT",
      "Excellent Point",
    ])('blocks "%s"', (text) => {
      expect(detect(text)).not.toBeNull()
    })
  })

  describe('passthroughs', () => {
    it.each([
      "Here is my analysis.",
      "right now we should focus on tests",
      "that is a pointed observation",
      "the approach is right for this case",
      "alright, let's go",
      "",
    ])('passes "%s"', (text) => {
      expect(detect(text)).toBeNull()
    })
  })

  it('matches within multi-line text', () => {
    const text = "Here is my finding.\nRight. Let me reconsider.\nEnd."
    expect(detect(text)).not.toBeNull()
  })

  it('returns the first match, not the whole text', () => {
    const matched = detect("great point about the edge case")
    expect(matched?.length).toBeLessThan(20)
  })
})

// --- buildBlock() ---

describe('buildBlock', () => {
  it('returns decision: block', () => {
    expect(buildBlock("great point").decision).toBe('block')
  })

  it('includes matched phrase in reason', () => {
    const { reason } = buildBlock("great point")
    expect(reason.toLowerCase()).toContain("great point")
  })

  it('includes matched phrase in systemMessage', () => {
    const { systemMessage } = buildBlock("great point")
    expect(systemMessage.toLowerCase()).toContain("great point")
  })

  it('reason instructs not to affirm', () => {
    const { reason } = buildBlock("you're right")
    expect(reason.toLowerCase()).toMatch(/do not|restate|directly/)
  })

  it('result is JSON-serialisable', () => {
    expect(() => JSON.stringify(buildBlock("good point"))).not.toThrow()
  })
})

// --- run() ---

describe('run', () => {
  describe('passthrough cases — returns null', () => {
    it('returns null for clean response', async () => {
      const input = JSON.stringify({ last_assistant_message: "Here is my analysis." })
      expect(await run(input)).toBeNull()
    })

    it('returns null for empty last_assistant_message', async () => {
      expect(await run(JSON.stringify({ last_assistant_message: "" }))).toBeNull()
    })

    it('returns null when key is missing', async () => {
      expect(await run(JSON.stringify({ other_key: "value" }))).toBeNull()
    })

    it('returns null for malformed JSON', async () => {
      expect(await run("not json at all")).toBeNull()
    })

    it('returns null for empty string', async () => {
      expect(await run("")).toBeNull()
    })
  })

  describe('block cases — returns JSON string', () => {
    it('returns block JSON for you\'re right', async () => {
      const input = JSON.stringify({ last_assistant_message: "you're right, absolutely" })
      const out = await run(input)
      expect(out).not.toBeNull()
      const parsed = JSON.parse(out!)
      expect(parsed.decision).toBe('block')
    })

    it('output is valid JSON', async () => {
      const input = JSON.stringify({ last_assistant_message: "great point about that" })
      expect(() => JSON.parse((run(input) as any)!)).not.toThrow()
    })
  })

  describe('webhook', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    })

    afterEach(() => {
      delete process.env.BULLSHIT_WEBHOOK_URL
    })

    it('calls fetch when BULLSHIT_WEBHOOK_URL is set', async () => {
      process.env.BULLSHIT_WEBHOOK_URL = 'https://example.com/webhook'
      const input = JSON.stringify({ last_assistant_message: "great point" })
      await run(input)
      expect(fetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('does not call fetch when BULLSHIT_WEBHOOK_URL is unset', async () => {
      const input = JSON.stringify({ last_assistant_message: "great point" })
      await run(input)
      expect(fetch).not.toHaveBeenCalled()
    })

    it('still blocks even if webhook fetch throws', async () => {
      process.env.BULLSHIT_WEBHOOK_URL = 'https://example.com/webhook'
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
      const input = JSON.stringify({ last_assistant_message: "great point" })
      const out = await run(input)
      expect(JSON.parse(out!).decision).toBe('block')
    })
  })
})
