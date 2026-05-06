import type { ToolboxMapping } from '../types'

/**
 * Toolbox function mappings.
 * Each entry identifies which MATLAB toolbox a function belongs to
 * and maps it to its Python equivalent + required import.
 */
export const TOOLBOX_MAP: Record<string, ToolboxMapping> = {
  // ── Signal Processing Toolbox → scipy.signal ───────────
  butter:      { python: 'signal.butter',        args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  cheby1:      { python: 'signal.cheby1',        args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  cheby2:      { python: 'signal.cheby2',        args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  ellip:       { python: 'signal.ellip',         args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  filtfilt:    { python: 'signal.filtfilt',       args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  filter:      { python: 'signal.lfilter',        args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  freqz:       { python: 'signal.freqz',         args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  spectrogram: { python: 'signal.spectrogram',   args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  pwelch:      { python: 'signal.welch',         args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  periodogram: { python: 'signal.periodogram',   args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  resample:    { python: 'signal.resample_poly',  args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  decimate:    { python: 'signal.decimate',       args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  interp:      { python: 'signal.resample',       args: 'custom',      imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  hilbert:     { python: 'signal.hilbert',        args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  conv:        { python: 'np.convolve',           args: 'passthrough', imports: ['numpy'],         toolbox: 'Signal Processing' },
  conv2:       { python: 'signal.convolve2d',     args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  xcorr:       { python: "np.correlate({a}, {b}, 'full')", args: 'custom', imports: ['numpy'],    toolbox: 'Signal Processing' },
  findpeaks: {
    python: 'signal.find_peaks',
    args: 'custom',
    imports: ['scipy.signal'],
    toolbox: 'Signal Processing',
    flag: { type: 'TOOLBOX', message: 'findpeaks → signal.find_peaks — returns (peaks_idx, properties) not (peaks_val, locs). Use x[peaks_idx] for values.' },
  },
  // yline/xline handled in special constructs for proper linespec parsing

  // ── Statistics Toolbox → scipy.stats / pandas ──────────
  normpdf:  { python: 'stats.norm.pdf',    args: 'passthrough', imports: ['scipy.stats'], toolbox: 'Statistics' },
  normcdf:  { python: 'stats.norm.cdf',    args: 'passthrough', imports: ['scipy.stats'], toolbox: 'Statistics' },
  norminv:  { python: 'stats.norm.ppf',    args: 'passthrough', imports: ['scipy.stats'], toolbox: 'Statistics' },
  normrnd:  { python: 'np.random.normal',  args: 'reshape',     imports: ['numpy'],       toolbox: 'Statistics' },
  ttest:    { python: 'stats.ttest_1samp', args: 'custom',      imports: ['scipy.stats'], toolbox: 'Statistics' },
  ttest2:   { python: 'stats.ttest_ind',   args: 'passthrough', imports: ['scipy.stats'], toolbox: 'Statistics' },
  anova1:   { python: 'stats.f_oneway',    args: 'custom',      imports: ['scipy.stats'], toolbox: 'Statistics' },
  chi2test: { python: 'stats.chi2_contingency', args: 'passthrough', imports: ['scipy.stats'], toolbox: 'Statistics' },
  corrcoef: { python: 'np.corrcoef',       args: 'passthrough', imports: ['numpy'],       toolbox: 'Statistics' },
  cov:      { python: 'np.cov',            args: 'passthrough', imports: ['numpy'],       toolbox: 'Statistics' },
  fitlm:    { python: 'sm.OLS',            args: 'custom',      imports: ['statsmodels'], toolbox: 'Statistics' },
  polyfit:  { python: 'np.polyfit',         args: 'passthrough', imports: ['numpy'],       toolbox: 'Statistics' },
  polyval:  { python: 'np.polyval',         args: 'passthrough', imports: ['numpy'],       toolbox: 'Statistics' },
  tabulate: { python: 'pd.value_counts',    args: 'passthrough', imports: ['pandas'],      toolbox: 'Statistics' },

  // ── Image Processing Toolbox → scikit-image ────────────
  imread:      { python: 'io.imread',             args: 'passthrough', imports: ['skimage.io'],         toolbox: 'Image Processing' },
  imwrite:     { python: 'io.imsave',             args: 'custom',      imports: ['skimage.io'],         toolbox: 'Image Processing' },
  imshow:      { python: 'plt.imshow',            args: 'passthrough', imports: ['matplotlib.pyplot'],  toolbox: 'Image Processing' },
  imresize:    { python: 'transform.resize',      args: 'custom',      imports: ['skimage.transform'],  toolbox: 'Image Processing' },
  imrotate:    { python: 'transform.rotate',      args: 'passthrough', imports: ['skimage.transform'],  toolbox: 'Image Processing' },
  rgb2gray:    { python: 'color.rgb2gray',        args: 'passthrough', imports: ['skimage.color'],      toolbox: 'Image Processing' },
  im2double:   { python: 'util.img_as_float',     args: 'passthrough', imports: ['skimage.util'],       toolbox: 'Image Processing' },
  imfilter:    { python: 'ndi.convolve',           args: 'passthrough', imports: ['scipy.ndimage'],      toolbox: 'Image Processing' },
  edge:        { python: 'feature.canny',          args: 'custom',      imports: ['skimage.feature'],    toolbox: 'Image Processing' },
  regionprops: { python: 'measure.regionprops',    args: 'passthrough', imports: ['skimage.measure'],    toolbox: 'Image Processing' },
  bwlabel:     { python: 'measure.label',          args: 'passthrough', imports: ['skimage.measure'],    toolbox: 'Image Processing' },
  imdilate:    { python: 'morphology.dilation',    args: 'passthrough', imports: ['skimage.morphology'], toolbox: 'Image Processing' },
  imerode:     { python: 'morphology.erosion',     args: 'passthrough', imports: ['skimage.morphology'], toolbox: 'Image Processing' },

  // ── Optimization Toolbox → scipy.optimize ──────────────
  fminunc:     { python: 'optimize.minimize',     args: 'passthrough', imports: ['scipy.optimize'], toolbox: 'Optimization' },
  fminsearch:  { python: "optimize.minimize({}, method='Nelder-Mead')", args: 'custom', imports: ['scipy.optimize'], toolbox: 'Optimization' },
  fmincon:     { python: 'optimize.minimize',     args: 'custom',      imports: ['scipy.optimize'], toolbox: 'Optimization',
    flag: { type: 'TOOLBOX', message: 'fmincon constraints require manual mapping to scipy.optimize format' },
  },
  fzero:       { python: 'optimize.brentq',       args: 'custom',      imports: ['scipy.optimize'], toolbox: 'Optimization',
    flag: { type: 'TOOLBOX', message: 'fzero → brentq requires interval [a, b] instead of initial guess' },
  },
  fsolve:      { python: 'optimize.fsolve',       args: 'passthrough', imports: ['scipy.optimize'], toolbox: 'Optimization' },
  lsqcurvefit: { python: 'optimize.curve_fit',    args: 'custom',      imports: ['scipy.optimize'], toolbox: 'Optimization' },
  linprog:     { python: 'optimize.linprog',      args: 'custom',      imports: ['scipy.optimize'], toolbox: 'Optimization' },
  quadprog:    { python: "optimize.minimize({}, method='SLSQP')", args: 'custom', imports: ['scipy.optimize'], toolbox: 'Optimization' },

  // ── Control Systems Toolbox → python-control ───────────
  tf:       { python: 'control.tf',              args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  ss:       { python: 'control.ss',              args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  zpk:      { python: 'control.zpk',             args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  bode:     { python: 'control.bode_plot',        args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  nyquist:  { python: 'control.nyquist_plot',     args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  step:     { python: 'control.step_response',    args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  impulse:  { python: 'control.impulse_response', args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  rlocus:   { python: 'control.root_locus',       args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  margin:   { python: 'control.margin',           args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  feedback: { python: 'control.feedback',         args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  series:   { python: 'control.series',           args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  parallel: { python: 'control.parallel',         args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  c2d:      { python: 'control.c2d',             args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  bodemag:  { python: 'control.bode_plot',       args: 'passthrough', imports: ['control'], toolbox: 'Control Systems',
    flag: { type: 'TOOLBOX', message: 'bodemag → control.bode_plot — shows magnitude only; add dB=True, deg=False for magnitude-only plot' },
  },

  // ── Symbolic Math Toolbox → SymPy ──────────────────────
  sym:       { python: 'sp.Symbol',              args: 'passthrough', imports: ['sympy'], toolbox: 'Symbolic Math' },
  syms:      { python: 'sp.symbols',             args: 'custom',      imports: ['sympy'], toolbox: 'Symbolic Math' },
  simplify:  { python: 'sp.simplify',            args: 'passthrough', imports: ['sympy'], toolbox: 'Symbolic Math' },
  expand:    { python: 'sp.expand',              args: 'passthrough', imports: ['sympy'], toolbox: 'Symbolic Math' },
  factor:    { python: 'sp.factor',              args: 'passthrough', imports: ['sympy'], toolbox: 'Symbolic Math' },
  solve:     { python: 'sp.solve',               args: 'passthrough', imports: ['sympy'], toolbox: 'Symbolic Math' },
  diff:      { python: 'sp.diff',                args: 'passthrough', imports: ['sympy'], toolbox: 'Symbolic Math',
    flag: { type: 'TOOLBOX', message: 'diff could be symbolic (sp.diff) or numeric (np.diff) — verify context' },
  },
  int:       { python: 'sp.integrate',           args: 'passthrough', imports: ['sympy'], toolbox: 'Symbolic Math' },
  limit:     { python: 'sp.limit',               args: 'passthrough', imports: ['sympy'], toolbox: 'Symbolic Math' },
  subs:      { python: '{}.subs',                args: 'template',    imports: ['sympy'], toolbox: 'Symbolic Math' },
  laplace:   { python: 'sp.laplace_transform',   args: 'passthrough', imports: ['sympy'], toolbox: 'Symbolic Math' },
  ilaplace:  { python: 'sp.inverse_laplace_transform', args: 'passthrough', imports: ['sympy'], toolbox: 'Symbolic Math' },

  // ── Wavelet Toolbox → PyWavelets ───────────────────────
  wavedec:   { python: 'pywt.wavedec',           args: 'passthrough', imports: ['pywt'], toolbox: 'Wavelet' },
  waverec:   { python: 'pywt.waverec',           args: 'passthrough', imports: ['pywt'], toolbox: 'Wavelet' },
  cwt:       { python: 'pywt.cwt',               args: 'passthrough', imports: ['pywt'], toolbox: 'Wavelet' },
  dwt:       { python: 'pywt.dwt',               args: 'passthrough', imports: ['pywt'], toolbox: 'Wavelet' },
  idwt:      { python: 'pywt.idwt',              args: 'passthrough', imports: ['pywt'], toolbox: 'Wavelet' },
  dwt2:      { python: 'pywt.dwt2',              args: 'passthrough', imports: ['pywt'], toolbox: 'Wavelet' },
  idwt2:     { python: 'pywt.idwt2',             args: 'passthrough', imports: ['pywt'], toolbox: 'Wavelet' },
  wthresh:   { python: 'pywt.threshold',          args: 'passthrough', imports: ['pywt'], toolbox: 'Wavelet' },

  // ── Communications Toolbox ──────────────────────────────
  pskmod:  { python: 'pskmod', args: 'passthrough', imports: [], toolbox: 'Communications',
    flag: { type: 'TODO', message: 'pskmod — no direct Python equivalent. Use np.exp(1j * 2*pi * data/M) for basic PSK, or install commpy: from commpy.modulation import PSKModem.' },
  },
  qammod:  { python: 'qammod', args: 'passthrough', imports: [], toolbox: 'Communications',
    flag: { type: 'TODO', message: 'qammod — no direct Python equivalent. Install commpy: from commpy.modulation import QAMModem, or implement manually with constellation mapping.' },
  },
  awgn:    { python: 'awgn', args: 'passthrough', imports: [], toolbox: 'Communications',
    flag: { type: 'TODO', message: 'awgn — add white Gaussian noise manually: noise_power = 10**(-SNRdB/10); signal + np.sqrt(noise_power) * np.random.randn(len(signal)).' },
  },
  gscatter: { python: 'gscatter', args: 'passthrough', imports: [], toolbox: 'Statistics',
    flag: { type: 'TODO', message: 'gscatter — use plt.scatter() with a loop per group, or seaborn.scatterplot(x, y, hue=labels) for grouped scatter plots.' },
  },
  confusionchart: { python: 'confusionchart', args: 'passthrough', imports: [], toolbox: 'Statistics',
    flag: { type: 'TODO', message: 'confusionchart — use sklearn.metrics.confusion_matrix() + sklearn.metrics.ConfusionMatrixDisplay.from_predictions() or seaborn.heatmap().' },
  },
  fitcecoc: { python: 'fitcecoc', args: 'passthrough', imports: [], toolbox: 'Statistics',
    flag: { type: 'TODO', message: 'fitcecoc — use sklearn.multiclass.OneVsOneClassifier(sklearn.svm.SVC()) for the same ECOC multi-class SVM approach.' },
  },

  // ── Curve Fitting → scipy.optimize / numpy ─────────────
  fit:       { python: 'optimize.curve_fit',      args: 'custom',      imports: ['scipy.optimize'], toolbox: 'Curve Fitting',
    flag: { type: 'TOOLBOX', message: 'fit → scipy.optimize.curve_fit — argument structure differs significantly' },
  },
  interp1:   { python: 'np.interp',              args: 'passthrough', imports: ['numpy'], toolbox: 'Curve Fitting' },
  interp2:   { python: 'scipy.interpolate.interp2d', args: 'passthrough', imports: ['scipy.interpolate'], toolbox: 'Curve Fitting' },
  spline:    { python: 'scipy.interpolate.CubicSpline', args: 'passthrough', imports: ['scipy.interpolate'], toolbox: 'Curve Fitting' },
  pchip:     { python: 'scipy.interpolate.PchipInterpolator', args: 'passthrough', imports: ['scipy.interpolate'], toolbox: 'Curve Fitting' },
}

/** Get all unique toolbox names detected from a set of function names */
export function detectToolboxes(functionNames: Set<string>): string[] {
  const toolboxes = new Set<string>()
  Array.from(functionNames).forEach(name => {
    const mapping = TOOLBOX_MAP[name]
    if (mapping) {
      toolboxes.add(mapping.toolbox)
    }
  })
  return Array.from(toolboxes).sort()
}
