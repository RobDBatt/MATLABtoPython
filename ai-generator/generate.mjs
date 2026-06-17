#!/usr/bin/env node
/**
 * SEO article generator for MATLABtoPython.com.
 *
 * Outputs TypeScript files that plug directly into src/content/.
 *
 * Usage:
 *   node generate.mjs                          # all topics
 *   node generate.mjs --topic matlab-ode45-to-scipy  # single topic
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { parseArgs } from 'util'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TOPICS_FILE = join(__dirname, 'topics.json')
const OUTPUT_DIR  = join(__dirname, 'output')
const MODEL       = 'claude-sonnet-4-6'

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })

const client = new Anthropic()   // reads ANTHROPIC_API_KEY from env

// ── Parse CLI args ────────────────────────────────────────

const { values: args } = parseArgs({
  options: { topic: { type: 'string' } },
  strict: false,
})

let topics = JSON.parse(readFileSync(TOPICS_FILE, 'utf8'))
if (args.topic) {
  topics = topics.filter(t => t.slug === args.topic)
  if (topics.length === 0) {
    console.error(`Topic "${args.topic}" not found in topics.json`)
    process.exit(1)
  }
}

// ── Prompt ────────────────────────────────────────────────

function buildPrompt(topic) {
  return `You are writing an SEO article for MATLABtoPython.com — a site for engineers
migrating from MATLAB to Python. The target reader knows MATLAB well and is
learning Python.

**Article details:**
- Slug: ${topic.slug}
- Title: ${topic.title}
- Primary keyword: ${topic.keyword}

**Output format — respond with ONLY valid JSON, no markdown fences, no preamble:**

{
  "description": "<150-char meta description with primary keyword>",
  "sections": [
    {
      "heading": "Section heading (no H1 — these become H2 on the page)",
      "body": "Full section body in Markdown. Use ${'```'}matlab and ${'```'}python fenced blocks for code. Use **bold** for emphasis."
    }
  ]
}

**Requirements:**
- 6–9 sections, 1500–2000 words total across all bodies
- Every code example must show MATLAB on one side and Python on the other, clearly labelled
- Lead with the concrete pain (cost, migration, correctness) not the feature
- Be specific: name exact functions, explain parameter differences, note edge cases
- End the final section with a CTA: "Paste your MATLAB code into the [free converter at mtopython.com/convert](/convert) to get Python output in under a second."
- Do NOT include an intro section called "Introduction" — the first section should have a descriptive heading
- Do NOT include a section called "Conclusion" — end with a useful reference section or the CTA section
- Use real, runnable code examples — not pseudocode
- Tone: precise, direct, developer-friendly. No filler phrases.`
}

// ── TypeScript file builder ───────────────────────────────

function buildTsFile(topic, parsed) {
  const today = new Date().toISOString().split('T')[0]
  const sectionsTs = parsed.sections
    .map(s => {
      // Escape backticks and ${} in body strings for template literals
      const safeBody = s.body
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$\{/g, '\\${')
      return `    {\n      heading: ${JSON.stringify(s.heading)},\n      body: \`${safeBody}\`,\n    },`
    })
    .join('\n')

  return `export const article = {
  slug: ${JSON.stringify(topic.slug)},
  title: ${JSON.stringify(topic.title)},
  description: ${JSON.stringify(parsed.description)},
  publishedAt: ${JSON.stringify(today)},
  keyword: ${JSON.stringify(topic.keyword)},
  sections: [
${sectionsTs}
  ],
}
`
}

// ── Generator ─────────────────────────────────────────────

async function generate(topic) {
  console.log(`\n→ ${topic.slug}`)

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 6000,
    messages: [{ role: 'user', content: buildPrompt(topic) }],
  })

  const raw = msg.content[0].text.trim()

  // Strip markdown fences if the model wrapped the JSON anyway
  const jsonStr = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  let parsed
  try {
    parsed = JSON.parse(jsonStr)
  } catch (err) {
    console.error(`  ✗ JSON parse failed:`, err.message)
    writeFileSync(join(OUTPUT_DIR, `${topic.slug}.raw.txt`), raw)
    console.error(`  Raw output saved to output/${topic.slug}.raw.txt`)
    return false
  }

  if (!parsed.sections?.length) {
    console.error('  ✗ No sections in output')
    return false
  }

  const ts = buildTsFile(topic, parsed)
  const outPath = join(OUTPUT_DIR, `${topic.slug}.ts`)
  writeFileSync(outPath, ts)
  console.log(`  ✓ ${parsed.sections.length} sections · ${ts.length} chars → output/${topic.slug}.ts`)
  return true
}

// ── Main ──────────────────────────────────────────────────

async function main() {
  console.log(`Generating ${topics.length} article(s) with ${MODEL}…`)

  let ok = 0
  for (const topic of topics) {
    const success = await generate(topic)
    if (success) ok++
    if (topics.indexOf(topic) < topics.length - 1) {
      await new Promise(r => setTimeout(r, 1500))
    }
  }

  console.log(`\nDone: ${ok}/${topics.length} succeeded.`)
  if (ok > 0) {
    console.log(`\nNext steps:`)
    console.log(`  1. Review files in ai-generator/output/`)
    console.log(`  2. Copy approved files to src/content/`)
    console.log(`  3. Import and add to src/content/index.ts`)
    console.log(`  4. Run: npm run build && npx vercel --prod`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
