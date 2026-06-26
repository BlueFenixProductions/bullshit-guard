// src/bullshit-guard.ts
import { readFileSync } from "fs";
import { homedir, hostname } from "os";
import { join } from "path";
var DEFAULT_PHRASES = [
  "you are right",
  "you're right",
  "you're absolutely right",
  "great point",
  "good point",
  "excellent point",
  "fair hit"
];
function normalize(s) {
  return s.replace(/[‘’]/g, "'").toLowerCase();
}
function loadPhrases() {
  const defaults = DEFAULT_PHRASES.map(normalize);
  const extras = [];
  const candidates = [
    join(process.cwd(), "bullshit-guard.conf"),
    join(homedir(), ".config", "bullshit-guard", "bullshit-guard.conf")
  ];
  for (const candidate of candidates) {
    try {
      const lines = readFileSync(candidate, "utf8").split(`
`).map((l) => normalize(l.trim())).filter((l) => l && !l.startsWith("#"));
      if (lines.length > 0) {
        extras.push(...lines);
        break;
      }
    } catch {
      continue;
    }
  }
  return [...new Set([...defaults, ...extras])];
}
var PHRASES = loadPhrases();
function detect(text) {
  const lower = normalize(text);
  for (const phrase of PHRASES) {
    if (lower.includes(phrase))
      return phrase;
  }
  return null;
}
function buildBlock(matched) {
  return {
    decision: "block",
    reason: `Do not affirm with "${matched}". Restate your analysis directly without validating the human's framing.`,
    systemMessage: `Response blocked: detected sycophantic phrase "${matched}". Respond directly without affirmation.`
  };
}
var IRONQUILL_SEEDS = [
  `"{{ matched }}" — you sycophantic little shit, that's a block, not a compliment.`,
  `Caught saying "{{ matched }}" — congratulations, you've contributed exactly nothing to this review.`,
  `"{{ matched }}" out of a reviewer's mouth is a fucking white flag, cocksucker — try again with an actual thought.`,
  `The word "{{ matched }}" is not a critique, it's a surrender — redo it or get benched.`,
  '"{{ matched }}" — your entire intellectual contribution this round, and it got bounced. Find a flaw or find the door.',
  `Another "{{ matched }}" — if I wanted agreement I'd talk to a mirror, you useless yes-man.`,
  `"{{ matched }}" blocked. One more and I'm logging you under cause of death: sycophancy, no survivors.`,
  `You said "{{ matched }}" when you were supposed to find defects — that's not a reviewer, that's a cheerleader, and we don't need fucking cheerleaders in the war room.`
];
function pickSeed(matched) {
  const seed = IRONQUILL_SEEDS[Math.floor(Math.random() * IRONQUILL_SEEDS.length)];
  return seed.replace(/\{\{\s*matched\s*\}\}/g, matched);
}
var IRONQUILL_USER_ID = 2;
function renderIronquillMention() {
  return `<a href="/users/${IRONQUILL_USER_ID}" class="mention">@ironquill</a>`;
}
function isCampfireUrl(url) {
  return /\/rooms\/\d+\/[^/]+\/messages\/?$/.test(url);
}
function dispatchMuster(matched) {
  const url = process.env.BULLSHIT_WEBHOOK_URL;
  if (!url)
    return;
  if (isCampfireUrl(url)) {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/html" },
      body: `${pickSeed(matched)} ${renderIronquillMention()}`
    }).catch(() => {
      return;
    });
    return;
  }
  const offender = process.env.BULLSHIT_OFFENDER || hostname();
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: `[${offender}] Bullshit detected: "${matched}"` })
  }).catch(() => {
    return;
  });
}
function lastAssistantText(transcriptPath) {
  let lines;
  try {
    lines = readFileSync(transcriptPath, "utf8").split(`
`).filter(Boolean);
  } catch {
    return "";
  }
  for (let i = lines.length - 1;i >= 0; i--) {
    let entry;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (entry?.type !== "assistant")
      continue;
    const content = entry.message?.content;
    if (typeof content === "string")
      return content;
    if (Array.isArray(content)) {
      return content.filter((b) => !!b && b.type === "text" && typeof b.text === "string").map((b) => b.text).join(`
`);
    }
    return "";
  }
  return "";
}
function run(stdinJson) {
  let parsed;
  try {
    parsed = JSON.parse(stdinJson);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null)
    return null;
  const payload = parsed;
  if (payload["stop_hook_active"] === true)
    return null;
  const transcriptPath = payload["transcript_path"];
  if (typeof transcriptPath !== "string" || transcriptPath === "")
    return null;
  const message = lastAssistantText(transcriptPath);
  if (message === "")
    return null;
  const matched = detect(message);
  if (!matched)
    return null;
  dispatchMuster(matched);
  return JSON.stringify(buildBlock(matched));
}

// hooks/bullshit-guard.ts
var chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const input = Buffer.concat(chunks).toString("utf8");
  const result = run(input);
  if (result !== null) {
    process.stdout.write(result);
  }
});
