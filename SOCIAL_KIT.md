# Social & distribution kit — mtopython.com

Copy/paste-ready posts for each channel. Don't post all at once — stagger
across a week or two so the analytics signal separates by source.

All site links auto-pick up Open Graph + Twitter Card metadata now, so
previews render with the site description and (eventually) an image.

---

## 1. Show HN (highest ceiling, single shot)

**When to submit:** Tuesday–Thursday, 7:00–10:00 AM US Eastern. Avoid
major news cycles. Be at your computer for the first hour to reply.

**URL field:** `https://mtopython.com/convert`

**Title (80 char limit):**

> Show HN: Deterministic MATLAB-to-Python converter, no AI, 72% real-world pass rate

**Text (optional — HN allows empty, but a short post helps):**

```
I got tired of MATLAB-to-Python converters that silently produce broken
code. The LLM wrappers hallucinate index shifts and invent function
signatures. The academic translators (smop, libermate) have been
dormant since ~2020.

I built a deterministic rule-based engine. Same MATLAB in → same Python
out, every time. Currently converts 72% of real-world MATLAB files
(tested on 314 scripts from export_fig, lightspeed, spatialmath-matlab)
to syntactically valid Python that py_compile accepts. The other 28%
get honest flags telling you exactly which lines need human review.

Two decisions worth calling out:

1. Not 100%, and I say so everywhere. Claims of "100% accurate" MATLAB
   converters are lies — some constructs (classdef handle semantics,
   eval, column-major flatten) don't have clean Python equivalents.
   Flagging is honest; hiding is not.

2. A tiny runtime shim on PyPI (matlabtopython-compat, 15kB) fills the
   handful of gaps where numpy alone doesn't match MATLAB semantics:
   CellArray, Struct with attribute+dict access, sprintf with vector
   expansion, column-major flatten. Pair it with the converter and
   more code just runs.

There's a /debug view that shows how any paste decomposes through the
5-stage pipeline. Free for 50 lines; paid tiers for file upload and
batch conversion.

Would love to hear cases where the converter gets something wrong.
Open-source scientific MATLAB is my test corpus, which may not
represent everyone's real engineering code.
```

**Engagement tips:**

- Reply to every comment in the first hour. Hostile replies are the
  #1 reason posts fall off the front page.
- If someone flags a real bug, fix it same-day and post back. HN loves
  fix-on-the-fly.
- Don't argue with the "you should've used an AI" thread. One calm
  reply explaining the positioning, then move on.

---

## 2. Reddit — r/learnpython and r/MATLAB

**Do not post to r/Python** — they're strict about self-promotion and
this will get removed.

**r/learnpython post:**

Title:
> Built a MATLAB-to-Python converter to help engineers migrate off perpetual licenses — feedback welcome

Body:
```
I made a site that converts MATLAB code to Python deterministically
(no AI — it's rule-based). Free for up to 50 lines, no account required.

The conversion is the part everyone hates when moving between the two:
1-indexed to 0-indexed shifting, toolbox functions mapping to
scipy/numpy, sprintf format strings, all of that.

10 MATLAB toolboxes are mapped (Signal Processing, Statistics, Image
Processing, Optimization, Control Systems, Deep Learning, Curve
Fitting, Parallel Computing, Symbolic Math, Database). Unmapped
functions get flagged with a TODO comment so you know what to review.

It's at mtopython.com — would genuinely appreciate trying it on code
you know well and telling me where it breaks. I'm especially curious
about what patterns you hit that the converter can't handle yet.
```

**r/MATLAB post (ride the license-change sentiment):**

Title:
> If you're considering moving MATLAB code to Python — a free converter that flags what it can't do

Body:
```
Built this after MathWorks ended perpetual licenses. It's a
rule-based MATLAB-to-Python converter — no AI, so same input always
produces the same output. Covers 10 toolboxes and handles the common
idioms (1-indexed arrays, end keyword, cell arrays, structs, etc.).

When it can't convert something with high confidence, it flags the
line rather than guessing — I think that's more honest than what the
LLM-based alternatives do.

Link: mtopython.com. Free for small pastes. Real engineering feedback
welcome, especially if your code is more complex than my test corpus.
```

**r/MATLAB caveats:** subreddit is small and MATLAB-loyal. Expect push-back.
Don't argue; take the feedback for the bug tracker.

---

## 3. LinkedIn post

Target: engineering managers, researchers, PhDs, R&D leads.

```
MATLAB perpetual licenses ended in January 2026. Every seat is now
$2,000+/year — forever.

I built a free tool for teams evaluating a move to Python:
mtopython.com. It's a deterministic rule-based MATLAB-to-Python
converter. No AI, no hallucinations — same input always produces
the same output.

10 toolboxes mapped. File upload for Pro. Batch folder conversion
for Teams. And the honest bit: it converts 72% of real-world MATLAB
files to valid Python first try, and flags the rest with specific
TODOs instead of guessing wrong.

Built on open-source MATLAB test corpora (export_fig, lightspeed,
spatialmath-matlab), so the coverage is measured, not claimed. The
debug view shows exactly how any paste decomposes — good for
verifying it handles your specific codebase before committing to
a migration.

Free tier is 50 lines, no signup. Pro tier for larger projects.

If you're on a team evaluating the switch, this is the cheapest
way to measure "how much of our code actually needs a rewrite
vs. just a translation." Would love feedback from anyone running
the numbers on an existing MATLAB codebase.
```

Image to attach: screenshot of the `/debug` view side-by-side showing
MATLAB input and Python output. Captures the "deterministic" claim
visually.

---

## 4. Twitter / X thread

One-line hooks get scrolled past. A 4-tweet thread works.

```
1/ MathWorks ended perpetual MATLAB licenses in January 2026.
   Every seat is now $2,000+/year. For real.

   So I built the opposite of the current MATLAB-to-Python converters:
   deterministic. Rule-based. No AI. mtopython.com

2/ The AI converters (CodeConvert, etc.) are fast but unreliable.
   They hallucinate index shifts and invent function signatures.
   The academic translators (smop, libermate) are dormant since 2020.

   Deterministic fills the gap. Same input → same output. Always.

3/ Currently converts 72% of real-world MATLAB files to valid Python
   (tested on 314 scripts from major open-source MATLAB libraries).

   The other 28% get honest TODO flags pointing at specific lines.
   Flagging > silently wrong output.

4/ 10 toolboxes mapped, /debug view shows exactly what it does to
   any code, and there's a tiny PyPI runtime shim for the edge cases
   numpy doesn't handle:

   pip install matlabtopython-compat

   Free for 50-line pastes. No signup.
   mtopython.com
```

Replies engagement: respond to the "why not AI" question with a link
to /debug. Most devs click once they see a deterministic pipeline
visually.

---

## 5. DEV.to cross-post (RSS-based)

Once the RSS feed is indexed, DEV.to can auto-import articles. Set it up:

1. Go to https://dev.to/settings/extensions
2. Under "Publishing to DEV Community from RSS", add: `https://mtopython.com/feed.xml`
3. Articles appear on DEV with canonical link back to mtopython.com
   (preserves SEO).

Cost: zero. One-time setup.

---

## 6. Awesome-list PR targets

GitHub "awesome list" pages aggregate quality tools. Each entry = one
free backlink from a high-authority domain. Submit a PR to:

- https://github.com/vinta/awesome-python — under "Code Tools" or "MATLAB"
- https://github.com/mikeroyal/MATLAB-Guide — add under "Alternatives to MATLAB"
- https://github.com/uhub/awesome-matlab — check if accepting converter listings

Suggested PR text:

```markdown
* [matlabtopython.com](https://mtopython.com) — Deterministic
  MATLAB-to-Python converter. Rule-based (no AI), 10 toolboxes mapped,
  honest flags instead of silent wrong output. Free tier + PyPI runtime
  shim ([matlabtopython-compat](https://pypi.org/project/matlabtopython-compat/)).
```

PRs usually take 1-4 weeks to merge. Free, high-leverage backlinks.

---

## 7. DEV.to original post (optional, takes 15 min)

Written post, not just RSS-sync. Title:

> How I built a deterministic MATLAB-to-Python converter (no AI, 72% pass rate)

Open with the problem (MATLAB license changes). Show the stack
(regex → scope pre-pass → idiom library → validator). Honest
numbers. Link the site in a "Try it yourself" section at the end.

Higher effort than the cross-post, but DEV.to content ranks well
in Google and the audience is exactly your target reader.

---

## Tracking

Every link above should have UTM parameters so Vercel Analytics tells
you which channel drove which signups. Use these templates:

- Show HN: `?utm_source=hn&utm_medium=social&utm_campaign=show-hn`
- Reddit r/learnpython: `?utm_source=reddit&utm_medium=social&utm_campaign=learnpython`
- Reddit r/MATLAB: `?utm_source=reddit&utm_medium=social&utm_campaign=matlab`
- LinkedIn: `?utm_source=linkedin&utm_medium=social&utm_campaign=launch`
- Twitter: `?utm_source=twitter&utm_medium=social&utm_campaign=thread`
- DEV.to: `?utm_source=devto&utm_medium=content&utm_campaign=launch`

After 1-2 weeks check Vercel Analytics → Top Referrers and Top
Campaign Tags. That tells you where to double down.
