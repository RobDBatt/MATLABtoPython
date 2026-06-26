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
import { article as imageProcessing } from './matlab-image-processing-to-scikit-image'
import { article as ode45ToScipy } from './matlab-ode45-to-scipy'
import { article as cellArrays } from './matlab-cell-arrays-to-python'
import { article as structToDict } from './matlab-struct-to-python-dict'
import { article as findpeaksToScipy } from './matlab-findpeaks-python'
import { article as fftToNumpy } from './matlab-fft-python'
import { article as reshapeToNumpy } from './matlab-reshape-python'
import { article as interp1ToScipy } from './matlab-interp1-python'
import { article as arrayfunToPython } from './matlab-arrayfun-python'
import { article as cellfunToPython } from './matlab-cellfun-python'
import { article as repmatToNumpy } from './matlab-repmat-python'
import { article as sortrowsToNumpy } from './matlab-sortrows-python'
import { article as sprintfNum2str } from './matlab-sprintf-num2str-python'
import { article as bsxfunToNumpy } from './matlab-bsxfun-python'
import { article as regexprepToRe } from './matlab-regexprep-python'
import { article as accumarrayToNumpy } from './matlab-accumarray-python'
import { article as migrationGuide } from './matlab-to-python-migration-guide'

export const articles = [
  migrationGuide,
  cheatSheet,
  gotchas,
  indexingGuide,
  forLoops,
  plotToMatplotlib,
  signalToScipy,
  findpeaksToScipy,
  fftToNumpy,
  reshapeToNumpy,
  interp1ToScipy,
  arrayfunToPython,
  cellfunToPython,
  repmatToNumpy,
  sortrowsToNumpy,
  sprintfNum2str,
  bsxfunToNumpy,
  regexprepToRe,
  accumarrayToNumpy,
  imageProcessing,
  ode45ToScipy,
  cellArrays,
  structToDict,
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
