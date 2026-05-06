import { article as whatConversionSaves } from './what-automated-conversion-actually-saves-you'
import { article as aiVsDeterministic } from './ai-converter-vs-deterministic'
import { article as converters2026 } from './matlab-to-python-converters-2026'
import { article as whyWeBuiltThis } from './why-we-built-this'
import { article as gotchas } from './matlab-python-gotchas'
import { article as cheatSheet } from './matlab-to-numpy-cheat-sheet'
import { article as licenseCost } from './matlab-license-cost-2026'
import { article as matlabVsPython } from './matlab-vs-python-2026'
import { article as indexingGuide } from './matlab-1-indexed-to-python-0-indexed'
import { article as forLoops } from './matlab-for-loops-to-python'
import { article as plotToMatplotlib } from './matlab-plot-to-matplotlib'
import { article as signalToScipy } from './matlab-signal-processing-to-scipy'

export const articles = [
  cheatSheet,
  gotchas,
  indexingGuide,
  forLoops,
  plotToMatplotlib,
  signalToScipy,
  matlabVsPython,
  licenseCost,
  whyWeBuiltThis,
  converters2026,
  aiVsDeterministic,
  whatConversionSaves,
]

export function getArticle(slug: string) {
  return articles.find(a => a.slug === slug) || null
}

export function getAllSlugs() {
  return articles.map(a => a.slug)
}
