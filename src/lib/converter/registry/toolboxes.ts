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
  interp1:   { python: 'np.interp',              args: 'passthrough', imports: ['numpy'], toolbox: 'Curve Fitting', argReorder: [2, 0, 1] },
  interp2:   { python: 'interpolate.interp2d', args: 'passthrough', imports: ['scipy.interpolate'], toolbox: 'Curve Fitting' },
  spline:    { python: 'interpolate.CubicSpline', args: 'passthrough', imports: ['scipy.interpolate'], toolbox: 'Curve Fitting' },
  pchip:     { python: 'interpolate.PchipInterpolator', args: 'passthrough', imports: ['scipy.interpolate'], toolbox: 'Curve Fitting' },

  // ── Toolbox coverage sweep (2026-07): every entry below was a confirmed
  // PASSTHROUGH in the e2e probe. Exact-signature matches map silently
  // (plus the automatic TOOLBOX review flag); known differences carry an
  // explicit flag; no-equivalent functions are flagged, not guessed. ──

  // Statistics — random number generation (numpy.random signatures match)
  unifrnd:   { python: 'np.random.uniform',  args: 'passthrough', imports: ['numpy'], toolbox: 'Statistics' },
  exprnd:    { python: 'np.random.exponential', args: 'passthrough', imports: ['numpy'], toolbox: 'Statistics' },
  poissrnd:  { python: 'np.random.poisson',  args: 'passthrough', imports: ['numpy'], toolbox: 'Statistics' },
  binornd:   { python: 'np.random.binomial', args: 'passthrough', imports: ['numpy'], toolbox: 'Statistics' },
  gamrnd:    { python: 'np.random.gamma',    args: 'passthrough', imports: ['numpy'], toolbox: 'Statistics' },
  betarnd:   { python: 'np.random.beta',     args: 'passthrough', imports: ['numpy'], toolbox: 'Statistics' },
  mvnrnd:    { python: 'np.random.multivariate_normal', args: 'passthrough', imports: ['numpy'], toolbox: 'Statistics' },
  mvnpdf:    { python: 'stats.multivariate_normal.pdf', args: 'passthrough', imports: ['scipy.stats'], toolbox: 'Statistics' },
  randsample: {
    python: 'np.random.choice', args: 'passthrough', imports: ['numpy'], toolbox: 'Statistics',
    flag: { type: 'WARNING', message: 'randsample samples WITHOUT replacement by default — add replace=False to np.random.choice.' },
  },
  datasample: {
    python: 'np.random.choice', args: 'passthrough', imports: ['numpy'], toolbox: 'Statistics',
    flag: { type: 'WARNING', message: 'datasample(data, k) → np.random.choice(data, k) — with replacement by default in both, but dim/weights args differ.' },
  },

  // Statistics — descriptive / NaN-aware
  nanmean:   { python: 'np.nanmean',   args: 'passthrough', imports: ['numpy'], toolbox: 'Statistics' },
  nansum:    { python: 'np.nansum',    args: 'passthrough', imports: ['numpy'], toolbox: 'Statistics' },
  nanmax:    { python: 'np.nanmax',    args: 'passthrough', imports: ['numpy'], toolbox: 'Statistics' },
  nanmin:    { python: 'np.nanmin',    args: 'passthrough', imports: ['numpy'], toolbox: 'Statistics' },
  nanmedian: { python: 'np.nanmedian', args: 'passthrough', imports: ['numpy'], toolbox: 'Statistics' },
  nanstd: {
    python: 'np.nanstd', args: 'passthrough', imports: ['numpy'], toolbox: 'Statistics',
    flag: { type: 'WARNING', message: 'MATLAB nanstd normalizes by N-1; add ddof=1 to np.nanstd.' },
  },

  // Statistics — clustering / distance (scipy signatures match)
  pdist:      { python: 'spatial.distance.pdist', args: 'passthrough', imports: ['scipy.spatial'], toolbox: 'Statistics' },
  squareform: { python: 'spatial.distance.squareform', args: 'passthrough', imports: ['scipy.spatial'], toolbox: 'Statistics' },
  linkage:    { python: 'cluster.hierarchy.linkage', args: 'passthrough', imports: ['scipy.cluster'], toolbox: 'Statistics' },
  kmeans: {
    python: 'cluster.vq.kmeans2', args: 'passthrough', imports: ['scipy.cluster'], toolbox: 'Statistics',
    flag: { type: 'WARNING', message: 'kmeans returns [idx, C]; cluster.vq.kmeans2 returns (centroid, label) — SWAPPED order.' },
  },
  pca: {
    python: 'pca', args: 'passthrough', imports: [], toolbox: 'Statistics',
    flag: { type: 'TODO', message: 'pca → np.linalg.svd on the centered data, or sklearn.decomposition.PCA — output layout differs from MATLAB [coeff, score, latent].' },
  },
  fitgmdist: {
    python: 'fitgmdist', args: 'passthrough', imports: [], toolbox: 'Statistics',
    flag: { type: 'TODO', message: 'fitgmdist → sklearn.mixture.GaussianMixture(n).fit(X) — object API differs.' },
  },

  // Statistics — hypothesis tests / regression
  ranksum: {
    python: 'stats.ranksums', args: 'passthrough', imports: ['scipy.stats'], toolbox: 'Statistics',
    flag: { type: 'WARNING', message: 'ranksum returns [p, h]; stats.ranksums returns (statistic, pvalue) — different order and contents. stats.mannwhitneyu matches MATLAB more closely for small samples.' },
  },
  signrank: {
    python: 'stats.wilcoxon', args: 'passthrough', imports: ['scipy.stats'], toolbox: 'Statistics',
    flag: { type: 'WARNING', message: 'signrank returns [p, h]; stats.wilcoxon returns (statistic, pvalue).' },
  },
  kstest2: {
    python: 'stats.ks_2samp', args: 'passthrough', imports: ['scipy.stats'], toolbox: 'Statistics',
    flag: { type: 'WARNING', message: 'kstest2 returns [h, p]; stats.ks_2samp returns (statistic, pvalue).' },
  },
  kstest: {
    python: 'kstest', args: 'passthrough', imports: [], toolbox: 'Statistics',
    flag: { type: 'TODO', message: "kstest(x) tests against a STANDARD NORMAL by default → stats.kstest(x, 'norm'); the [h,p] return also differs." },
  },
  regress: {
    python: 'regress', args: 'passthrough', imports: [], toolbox: 'Statistics',
    flag: { type: 'TODO', message: 'regress(y, X) → np.linalg.lstsq(X, y, rcond=None)[0] (note the swapped args) or statsmodels OLS for the stats outputs.' },
  },
  glmfit: {
    python: 'glmfit', args: 'passthrough', imports: [], toolbox: 'Statistics',
    flag: { type: 'TODO', message: 'glmfit → statsmodels sm.GLM(y, X, family=...).fit() — API differs substantially.' },
  },
  crossval: {
    python: 'crossval', args: 'passthrough', imports: [], toolbox: 'Statistics',
    flag: { type: 'TODO', message: 'crossval → sklearn.model_selection.cross_val_score — API differs substantially.' },
  },
  ecdf: {
    python: 'ecdf', args: 'passthrough', imports: [], toolbox: 'Statistics',
    flag: { type: 'TODO', message: 'ecdf(x) → np.sort(x) with np.arange(1, len(x)+1)/len(x), or stats.ecdf (scipy ≥ 1.11).' },
  },
  ksdensity: {
    python: 'stats.gaussian_kde', args: 'passthrough', imports: ['scipy.stats'], toolbox: 'Statistics',
    flag: { type: 'WARNING', message: 'ksdensity returns [f, xi]; stats.gaussian_kde returns a callable object — evaluate it on your grid.' },
  },

  // Signal Processing (scipy.signal signatures match unless flagged)
  freqs:     { python: 'signal.freqs',    args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  besself:   { python: 'signal.bessel',   args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  buttord:   { python: 'signal.buttord',  args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  cheb1ord:  { python: 'signal.cheb1ord', args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  tukeywin:  { python: 'signal.windows.tukey', args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  chebwin:   { python: 'signal.windows.chebwin', args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  gausswin: {
    python: 'signal.windows.gaussian', args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing',
    flag: { type: 'WARNING', message: 'gausswin(L, alpha) parameterizes by ALPHA; signal.windows.gaussian takes STD — std = (L-1)/(2*alpha).' },
  },
  medfilt1:  { python: 'signal.medfilt',  args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  medfilt2:  { python: 'ndi.median_filter', args: 'passthrough', imports: ['scipy.ndimage'], toolbox: 'Image Processing' },
  czt:       { python: 'signal.czt',      args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  chirp:     { python: 'signal.chirp',    args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  sawtooth:  { python: 'signal.sawtooth', args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  sinc:      { python: 'np.sinc',         args: 'passthrough', imports: ['numpy'], toolbox: 'Signal Processing' },
  detrend:   { python: 'signal.detrend',  args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing' },
  square: {
    python: 'signal.square', args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing',
    flag: { type: 'WARNING', message: 'square(t, duty) takes duty in PERCENT; signal.square takes a 0-1 fraction — divide by 100.' },
  },
  grpdelay: {
    python: 'signal.group_delay', args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing',
    flag: { type: 'WARNING', message: 'grpdelay(b, a) → signal.group_delay((b, a)) — the coefficients go in ONE tuple arg.' },
  },
  firpm: {
    python: 'signal.remez', args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing',
    flag: { type: 'WARNING', message: 'firpm(n, f, a) → signal.remez(n+1, bands, desired) — order is n+1 taps and the band/amplitude format differs.' },
  },
  cpsd: {
    python: 'signal.csd', args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing',
    flag: { type: 'WARNING', message: 'cpsd returns [Pxy, f]; signal.csd returns (f, Pxy) — SWAPPED.' },
  },
  mscohere: {
    python: 'signal.coherence', args: 'passthrough', imports: ['scipy.signal'], toolbox: 'Signal Processing',
    flag: { type: 'WARNING', message: 'mscohere returns [Cxy, f]; signal.coherence returns (f, Cxy) — SWAPPED.' },
  },
  xcov: {
    python: 'xcov', args: 'passthrough', imports: [], toolbox: 'Signal Processing',
    flag: { type: 'TODO', message: 'xcov → signal.correlate(x - x.mean(), y - y.mean(), mode="full") — demean first; lag conventions differ.' },
  },
  filter2: {
    python: 'ndi.correlate', args: 'passthrough', imports: ['scipy.ndimage'], toolbox: 'Signal Processing',
    flag: { type: 'WARNING', message: "filter2(h, X) → ndi.correlate(X, h, mode='constant') — args are SWAPPED and boundary mode differs." },
  },
  impz: {
    python: 'impz', args: 'passthrough', imports: [], toolbox: 'Signal Processing',
    flag: { type: 'TODO', message: 'impz(b, a) → signal.lfilter(b, a, impulse) with impulse = np.zeros(n); impulse[0] = 1.' },
  },
  envelope: {
    python: 'envelope', args: 'passthrough', imports: [], toolbox: 'Signal Processing',
    flag: { type: 'TODO', message: 'envelope(x) → np.abs(signal.hilbert(x)) for the analytic-signal envelope.' },
  },
  upsample: {
    python: 'upsample', args: 'passthrough', imports: [], toolbox: 'Signal Processing',
    flag: { type: 'TODO', message: 'upsample(x, n) zero-stuffs: y = np.zeros(len(x)*n); y[::n] = x.' },
  },

  // Optimization
  lsqnonlin: {
    python: 'optimize.least_squares', args: 'passthrough', imports: ['scipy.optimize'], toolbox: 'Optimization',
    flag: { type: 'WARNING', message: 'lsqnonlin options/bounds args differ; optimize.least_squares(fun, x0, bounds=(lb, ub)).' },
  },
  lsqlin: {
    python: 'optimize.lsq_linear', args: 'passthrough', imports: ['scipy.optimize'], toolbox: 'Optimization',
    flag: { type: 'WARNING', message: 'lsqlin constraint args (A, b, Aeq, beq) differ from optimize.lsq_linear(A, b, bounds=...).' },
  },
  intlinprog: {
    python: 'optimize.milp', args: 'passthrough', imports: ['scipy.optimize'], toolbox: 'Optimization',
    flag: { type: 'WARNING', message: 'intlinprog → optimize.milp — the constraint API differs substantially (LinearConstraint objects).' },
  },
  ga: {
    python: 'ga', args: 'passthrough', imports: [], toolbox: 'Optimization',
    flag: { type: 'TODO', message: 'ga (genetic algorithm) → optimize.differential_evolution is the closest scipy analog; API differs.' },
  },
  patternsearch: {
    python: 'patternsearch', args: 'passthrough', imports: [], toolbox: 'Optimization',
    flag: { type: 'TODO', message: 'patternsearch → optimize.minimize(method="Nelder-Mead") or optimize.direct — no direct equivalent.' },
  },
  particleswarm: {
    python: 'particleswarm', args: 'passthrough', imports: [], toolbox: 'Optimization',
    flag: { type: 'TODO', message: 'particleswarm → pyswarms (pip) or optimize.differential_evolution — no scipy equivalent.' },
  },
  simulannealbnd: {
    python: 'simulannealbnd', args: 'passthrough', imports: [], toolbox: 'Optimization',
    flag: { type: 'TODO', message: 'simulannealbnd → optimize.dual_annealing(fun, bounds).' },
  },
  optimset: {
    python: 'optimset', args: 'passthrough', imports: [], toolbox: 'Optimization',
    flag: { type: 'TODO', message: "optimset/optimoptions → plain dict or scipy's options= kwarg (e.g. {'maxiter': 100}); option names differ." },
  },
  optimoptions: {
    python: 'optimoptions', args: 'passthrough', imports: [], toolbox: 'Optimization',
    flag: { type: 'TODO', message: "optimoptions → scipy options= dict; option names differ (MaxIterations → maxiter)." },
  },

  // Image Processing (skimage/ndimage)
  im2uint8:     { python: 'util.img_as_ubyte', args: 'passthrough', imports: ['skimage.util'], toolbox: 'Image Processing' },
  imopen:       { python: 'morphology.opening', args: 'passthrough', imports: ['skimage.morphology'], toolbox: 'Image Processing' },
  imclose:      { python: 'morphology.closing', args: 'passthrough', imports: ['skimage.morphology'], toolbox: 'Image Processing' },
  bwareaopen:   { python: 'morphology.remove_small_objects', args: 'passthrough', imports: ['skimage.morphology'], toolbox: 'Image Processing' },
  imcomplement: { python: 'util.invert', args: 'passthrough', imports: ['skimage.util'], toolbox: 'Image Processing' },
  label2rgb:    { python: 'color.label2rgb', args: 'passthrough', imports: ['skimage.color'], toolbox: 'Image Processing' },
  imnoise: {
    python: 'util.random_noise', args: 'passthrough', imports: ['skimage.util'], toolbox: 'Image Processing',
    flag: { type: 'WARNING', message: "imnoise mode names differ: 'salt & pepper' → mode='s&p'; output is float in [0,1]." },
  },
  imgaussfilt: {
    python: 'ndi.gaussian_filter', args: 'passthrough', imports: ['scipy.ndimage'], toolbox: 'Image Processing',
    flagWhen: (c) => !/imgaussfilt\s*\([^,)]+,/.test(c),
    flag: { type: 'WARNING', message: 'imgaussfilt defaults sigma=0.5; ndi.gaussian_filter REQUIRES sigma — pass 0.5 explicitly.' },
  },
  histeq: {
    python: 'exposure.equalize_hist', args: 'passthrough', imports: ['skimage.exposure'], toolbox: 'Image Processing',
    flag: { type: 'WARNING', message: 'histeq returns the same dtype; exposure.equalize_hist returns FLOAT in [0,1].' },
  },
  imadjust: {
    python: 'exposure.rescale_intensity', args: 'passthrough', imports: ['skimage.exposure'], toolbox: 'Image Processing',
    flag: { type: 'WARNING', message: 'imadjust in/out range args → exposure.rescale_intensity(in_range=..., out_range=...).' },
  },
  graythresh: {
    python: 'filters.threshold_otsu', args: 'passthrough', imports: ['skimage.filters'], toolbox: 'Image Processing',
    flag: { type: 'WARNING', message: 'graythresh returns a NORMALIZED [0,1] level; threshold_otsu returns an absolute intensity.' },
  },
  imtranslate: {
    python: 'ndi.shift', args: 'passthrough', imports: ['scipy.ndimage'], toolbox: 'Image Processing',
    flag: { type: 'WARNING', message: 'imtranslate takes [x, y]; ndi.shift takes (row, col) — REVERSED axes.' },
  },
  bwperim: {
    python: 'bwperim', args: 'passthrough', imports: [], toolbox: 'Image Processing',
    flag: { type: 'TODO', message: 'bwperim → segmentation.find_boundaries(bw, mode="inner") in skimage.' },
  },
  bwconncomp: {
    python: 'bwconncomp', args: 'passthrough', imports: [], toolbox: 'Image Processing',
    flag: { type: 'TODO', message: 'bwconncomp → measure.label + measure.regionprops; the CC struct fields have no direct analog.' },
  },
  bwmorph: {
    python: 'bwmorph', args: 'passthrough', imports: [], toolbox: 'Image Processing',
    flag: { type: 'TODO', message: "bwmorph(bw, 'op') → the matching skimage.morphology function ('thin' → thin, 'skel' → skeletonize, ...)." },
  },
  imcrop: {
    python: 'imcrop', args: 'passthrough', imports: [], toolbox: 'Image Processing',
    flag: { type: 'TODO', message: 'imcrop(I, rect) → array slicing: I[y:y+h, x:x+w] (note rect is [x y w h], 1-based).' },
  },

  // Control Systems (python-control; names match unless flagged)
  lqr:     { python: 'control.lqr',     args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  place:   { python: 'control.place',   args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  acker:   { python: 'control.acker',   args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  ctrb:    { python: 'control.ctrb',    args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  obsv:    { python: 'control.obsv',    args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  ssdata:  { python: 'control.ssdata',  args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  tfdata:  { python: 'control.tfdata',  args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  d2c:     { python: 'control.d2c',     args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  minreal: { python: 'control.minreal', args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  dcgain:  { python: 'control.dcgain',  args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  pole:    { python: 'control.poles',   args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  zero:    { python: 'control.zeros',   args: 'passthrough', imports: ['control'], toolbox: 'Control Systems' },
  lsim: {
    python: 'control.forced_response', args: 'passthrough', imports: ['control'], toolbox: 'Control Systems',
    flag: { type: 'WARNING', message: 'lsim returns [y, t, x]; control.forced_response returns a TimeResponseData object (`.time`, `.outputs`).' },
  },
  initial: {
    python: 'control.initial_response', args: 'passthrough', imports: ['control'], toolbox: 'Control Systems',
    flag: { type: 'WARNING', message: 'initial returns [y, t, x]; control.initial_response returns a TimeResponseData object.' },
  },

  // Interpolation / Curve Fitting
  griddata: {
    python: 'interpolate.griddata', args: 'passthrough', imports: ['scipy.interpolate'], toolbox: 'Curve Fitting',
    flag: { type: 'WARNING', message: 'griddata(x, y, v, xq, yq) → interpolate.griddata((x, y), v, (xq, yq)) — coordinates group into tuples.' },
  },
  interp3: {
    python: 'interpolate.interpn', args: 'passthrough', imports: ['scipy.interpolate'], toolbox: 'Curve Fitting',
    flag: { type: 'WARNING', message: 'interp3 → interpolate.interpn((x, y, z), V, points) — grid vectors group into a tuple; meshgrid order differs.' },
  },
  interpn: {
    python: 'interpolate.interpn', args: 'passthrough', imports: ['scipy.interpolate'], toolbox: 'Curve Fitting',
    flag: { type: 'WARNING', message: 'interpn grid vectors group into a tuple in scipy: interpolate.interpn((x1, x2, ...), V, points).' },
  },
  csaps: {
    python: 'csaps', args: 'passthrough', imports: [], toolbox: 'Curve Fitting',
    flag: { type: 'TODO', message: 'csaps → interpolate.make_smoothing_spline (scipy ≥ 1.10) or the csaps pip package; smoothing param conventions differ.' },
  },
  smooth: {
    python: 'smooth', args: 'passthrough', imports: [], toolbox: 'Curve Fitting',
    flag: { type: 'TODO', message: "smooth(y, span) moving average → np.convolve(y, np.ones(span)/span, mode='same'), or signal.savgol_filter for 'sgolay'." },
  },

  // Audio
  audioinfo: {
    python: 'sf.info', args: 'passthrough', imports: ['soundfile'], toolbox: 'Audio',
    flag: { type: 'WARNING', message: 'audioinfo struct fields map to sf.info attributes (samplerate, channels, frames).' },
  },
  sound: {
    python: 'sound', args: 'passthrough', imports: [], toolbox: 'Audio',
    flag: { type: 'TODO', message: 'sound/soundsc playback → sounddevice.play(y, fs) (pip install sounddevice).' },
  },
  soundsc: {
    python: 'soundsc', args: 'passthrough', imports: [], toolbox: 'Audio',
    flag: { type: 'TODO', message: 'soundsc scales then plays → sounddevice.play(y / np.max(np.abs(y)), fs).' },
  },

  // Financial (no numpy_financial dep by policy — closed forms are short)
  pv:   { python: 'pv',   args: 'passthrough', imports: [], toolbox: 'Financial', flag: { type: 'TODO', message: 'pv(rate, n, pmt) closed form: pmt * (1 - (1+rate)**-n) / rate. (numpy_financial has pv() if you accept the dependency.)' } },
  fv:   { python: 'fv',   args: 'passthrough', imports: [], toolbox: 'Financial', flag: { type: 'TODO', message: 'fv closed form: pmt * ((1+rate)**n - 1) / rate. (numpy_financial has fv().)' } },
  pmt:  { python: 'pmt',  args: 'passthrough', imports: [], toolbox: 'Financial', flag: { type: 'TODO', message: 'pmt closed form: pv * rate / (1 - (1+rate)**-n). (numpy_financial has pmt().)' } },
  nper: { python: 'nper', args: 'passthrough', imports: [], toolbox: 'Financial', flag: { type: 'TODO', message: 'nper closed form: log(pmt / (pmt - pv*rate)) / log(1+rate). (numpy_financial has nper().)' } },
  irr:  { python: 'irr',  args: 'passthrough', imports: [], toolbox: 'Financial', flag: { type: 'TODO', message: 'irr → np.roots on the cashflow polynomial, take the real root > -1. (numpy_financial has irr().)' } },
  npv:  { python: 'npv',  args: 'passthrough', imports: [], toolbox: 'Financial', flag: { type: 'TODO', message: 'npv(rate, cf) → np.sum(cf / (1+rate)**np.arange(1, len(cf)+1)) — note MATLAB discounts from period 1.' } },
  rate: { python: 'rate', args: 'passthrough', imports: [], toolbox: 'Financial', flag: { type: 'TODO', message: 'rate has no closed form → optimize.brentq on the annuity equation. (numpy_financial has rate().)' } },

  // Simulink / code generation — no Python equivalent by nature
  sim: {
    python: 'sim', args: 'passthrough', imports: [], toolbox: 'Simulink',
    flag: { type: 'UNSUPPORTED', message: 'sim() runs a Simulink MODEL (.slx block diagram) — there is no Python equivalent; the model itself cannot be converted. Reimplement the dynamics with scipy.integrate.solve_ivp.' },
  },
  set_param: {
    python: 'set_param', args: 'passthrough', imports: [], toolbox: 'Simulink',
    flag: { type: 'UNSUPPORTED', message: 'set_param manipulates a Simulink model — no Python equivalent.' },
  },
  get_param: {
    python: 'get_param', args: 'passthrough', imports: [], toolbox: 'Simulink',
    flag: { type: 'UNSUPPORTED', message: 'get_param reads a Simulink model — no Python equivalent.' },
  },
  open_system: {
    python: 'open_system', args: 'passthrough', imports: [], toolbox: 'Simulink',
    flag: { type: 'UNSUPPORTED', message: 'open_system opens a Simulink model — no Python equivalent.' },
  },
  load_system: {
    python: 'load_system', args: 'passthrough', imports: [], toolbox: 'Simulink',
    flag: { type: 'UNSUPPORTED', message: 'load_system loads a Simulink model — no Python equivalent.' },
  },
  codegen: {
    python: 'codegen', args: 'passthrough', imports: [], toolbox: 'MATLAB Coder',
    flag: { type: 'UNSUPPORTED', message: 'codegen compiles MATLAB to C — the Python-world analogs are Numba/Cython, which are workflow tools, not a function mapping.' },
  },

  // Symbolic Math (sympy)
  dsolve:  { python: 'sp.dsolve',  args: 'passthrough', imports: ['sympy'], toolbox: 'Symbolic Math' },
  collect: { python: 'sp.collect', args: 'passthrough', imports: ['sympy'], toolbox: 'Symbolic Math' },
  pretty:  { python: 'sp.pretty',  args: 'passthrough', imports: ['sympy'], toolbox: 'Symbolic Math' },
  vpa:     { python: 'sp.N',       args: 'passthrough', imports: ['sympy'], toolbox: 'Symbolic Math' },
  taylor: {
    python: 'sp.series', args: 'passthrough', imports: ['sympy'], toolbox: 'Symbolic Math',
    flag: { type: 'WARNING', message: 'taylor(f, x, a) → sp.series(f, x, a, n) — order arg conventions differ; call .removeO() to drop the O() term.' },
  },
  fourier: {
    python: 'sp.fourier_transform', args: 'passthrough', imports: ['sympy'], toolbox: 'Symbolic Math',
    flag: { type: 'WARNING', message: 'fourier/sympy transform CONVENTIONS differ (2π placement) — verify against your definition.' },
  },
  ifourier: {
    python: 'sp.inverse_fourier_transform', args: 'passthrough', imports: ['sympy'], toolbox: 'Symbolic Math',
    flag: { type: 'WARNING', message: 'ifourier/sympy transform conventions differ (2π placement).' },
  },
  ztrans: {
    python: 'ztrans', args: 'passthrough', imports: [], toolbox: 'Symbolic Math',
    flag: { type: 'TODO', message: 'ztrans has no direct sympy equivalent — build the sum manually: sp.summation(f * z**-n, (n, 0, sp.oo)).' },
  },
  iztrans: {
    python: 'iztrans', args: 'passthrough', imports: [], toolbox: 'Symbolic Math',
    flag: { type: 'TODO', message: 'iztrans has no direct sympy equivalent — use partial fractions + known pairs.' },
  },
  matlabFunction: {
    python: 'sp.lambdify', args: 'passthrough', imports: ['sympy'], toolbox: 'Symbolic Math',
    flag: { type: 'WARNING', message: "matlabFunction(f) → sp.lambdify(vars, f, 'numpy') — the VARIABLES come first in lambdify." },
  },

  // Deep Learning — no function mapping exists: the Python path is a
  // REARCHITECTURE onto PyTorch/Keras (training loop + module graph), not a
  // rename. Every entry flags with the concrete counterpart so the failure
  // is explained, never a bare NameError.
  trainNetwork: {
    python: 'trainNetwork', args: 'passthrough', imports: [], toolbox: 'Deep Learning',
    flag: { type: 'TODO', message: 'trainNetwork → a PyTorch/Keras training loop (model.fit in Keras; optimizer/loss loop in PyTorch). Deep Learning code needs rearchitecting, not renaming.' },
  },
  trainnet: {
    python: 'trainnet', args: 'passthrough', imports: [], toolbox: 'Deep Learning',
    flag: { type: 'TODO', message: 'trainnet → Keras model.fit or a PyTorch training loop.' },
  },
  dlnetwork: {
    python: 'dlnetwork', args: 'passthrough', imports: [], toolbox: 'Deep Learning',
    flag: { type: 'TODO', message: 'dlnetwork → torch.nn.Module / keras.Model.' },
  },
  dlarray: {
    python: 'dlarray', args: 'passthrough', imports: [], toolbox: 'Deep Learning',
    flag: { type: 'TODO', message: 'dlarray → torch.tensor(X, requires_grad=True) for autodiff arrays.' },
  },
  dlgradient: {
    python: 'dlgradient', args: 'passthrough', imports: [], toolbox: 'Deep Learning',
    flag: { type: 'TODO', message: 'dlgradient → torch.autograd.grad / loss.backward().' },
  },
  dlfeval: {
    python: 'dlfeval', args: 'passthrough', imports: [], toolbox: 'Deep Learning',
    flag: { type: 'TODO', message: 'dlfeval(f, ...) → call f directly; PyTorch traces gradients without a wrapper.' },
  },
  layerGraph: {
    python: 'layerGraph', args: 'passthrough', imports: [], toolbox: 'Deep Learning',
    flag: { type: 'TODO', message: 'layerGraph → keras.Sequential / torch.nn.Sequential (or a Module with explicit forward()).' },
  },
  trainingOptions: {
    python: 'trainingOptions', args: 'passthrough', imports: [], toolbox: 'Deep Learning',
    flag: { type: 'TODO', message: 'trainingOptions → optimizer + hyperparameter arguments (keras compile()/fit() kwargs; torch.optim constructor args).' },
  },
  imageDatastore: {
    python: 'imageDatastore', args: 'passthrough', imports: [], toolbox: 'Deep Learning',
    flag: { type: 'TODO', message: 'imageDatastore → torchvision.datasets.ImageFolder + DataLoader, or keras image_dataset_from_directory.' },
  },
  convolution2dLayer: {
    python: 'convolution2dLayer', args: 'passthrough', imports: [], toolbox: 'Deep Learning',
    flag: { type: 'TODO', message: 'convolution2dLayer → torch.nn.Conv2d / keras.layers.Conv2D.' },
  },
  fullyConnectedLayer: {
    python: 'fullyConnectedLayer', args: 'passthrough', imports: [], toolbox: 'Deep Learning',
    flag: { type: 'TODO', message: 'fullyConnectedLayer → torch.nn.Linear / keras.layers.Dense.' },
  },
  lstmLayer: {
    python: 'lstmLayer', args: 'passthrough', imports: [], toolbox: 'Deep Learning',
    flag: { type: 'TODO', message: 'lstmLayer → torch.nn.LSTM / keras.layers.LSTM.' },
  },
  reluLayer: {
    python: 'reluLayer', args: 'passthrough', imports: [], toolbox: 'Deep Learning',
    flag: { type: 'TODO', message: 'reluLayer → torch.nn.ReLU / keras.layers.ReLU.' },
  },
  maxPooling2dLayer: {
    python: 'maxPooling2dLayer', args: 'passthrough', imports: [], toolbox: 'Deep Learning',
    flag: { type: 'TODO', message: 'maxPooling2dLayer → torch.nn.MaxPool2d / keras.layers.MaxPooling2D.' },
  },
  softmaxLayer: {
    python: 'softmaxLayer', args: 'passthrough', imports: [], toolbox: 'Deep Learning',
    flag: { type: 'TODO', message: 'softmaxLayer → torch.nn.Softmax / keras.layers.Softmax.' },
  },
  batchNormalizationLayer: {
    python: 'batchNormalizationLayer', args: 'passthrough', imports: [], toolbox: 'Deep Learning',
    flag: { type: 'TODO', message: 'batchNormalizationLayer → torch.nn.BatchNorm2d / keras.layers.BatchNormalization.' },
  },
  dropoutLayer: {
    python: 'dropoutLayer', args: 'passthrough', imports: [], toolbox: 'Deep Learning',
    flag: { type: 'TODO', message: 'dropoutLayer → torch.nn.Dropout / keras.layers.Dropout.' },
  },
  imageInputLayer: {
    python: 'imageInputLayer', args: 'passthrough', imports: [], toolbox: 'Deep Learning',
    flag: { type: 'TODO', message: 'imageInputLayer → the input shape argument of the first layer (keras Input(shape=...)).' },
  },
  sequenceInputLayer: {
    python: 'sequenceInputLayer', args: 'passthrough', imports: [], toolbox: 'Deep Learning',
    flag: { type: 'TODO', message: 'sequenceInputLayer → input shape of the first recurrent layer.' },
  },
  classificationLayer: {
    python: 'classificationLayer', args: 'passthrough', imports: [], toolbox: 'Deep Learning',
    flag: { type: 'TODO', message: 'classificationLayer → CrossEntropyLoss (PyTorch) / categorical_crossentropy (Keras) as the LOSS, not a layer.' },
  },
  regressionLayer: {
    python: 'regressionLayer', args: 'passthrough', imports: [], toolbox: 'Deep Learning',
    flag: { type: 'TODO', message: 'regressionLayer → MSELoss / mean_squared_error as the LOSS, not a layer.' },
  },

  // Parallel Computing — pool management has no direct equivalent; the
  // Python idioms are multiprocessing/joblib/concurrent.futures. (parfor
  // itself already degrades to a serial `for` with a WARNING.)
  parpool: {
    python: 'parpool', args: 'passthrough', imports: [], toolbox: 'Parallel Computing',
    flag: { type: 'TODO', message: 'parpool → multiprocessing.Pool(n) / joblib.Parallel(n_jobs=n) — often deletable when the parfor was converted to a serial for.' },
  },
  gcp: {
    python: 'gcp', args: 'passthrough', imports: [], toolbox: 'Parallel Computing',
    flag: { type: 'TODO', message: 'gcp (get current pool) — no equivalent; usually deletable.' },
  },
  parcluster: {
    python: 'parcluster', args: 'passthrough', imports: [], toolbox: 'Parallel Computing',
    flag: { type: 'TODO', message: 'parcluster → cluster submission belongs to your scheduler (dask.distributed / SLURM scripts).' },
  },
  parfeval: {
    python: 'parfeval', args: 'passthrough', imports: [], toolbox: 'Parallel Computing',
    flag: { type: 'TODO', message: 'parfeval(pool, f, nout, args...) → concurrent.futures.Executor.submit(f, args...).' },
  },
  gpuArray: {
    python: 'gpuArray', args: 'passthrough', imports: [], toolbox: 'Parallel Computing',
    flag: { type: 'TODO', message: 'gpuArray → cupy.asarray (pip install cupy) — or delete and stay on CPU numpy; downstream code is usually identical.' },
  },
  distributed: {
    python: 'distributed', args: 'passthrough', imports: [], toolbox: 'Parallel Computing',
    flag: { type: 'TODO', message: 'distributed arrays → dask.array (pip install dask).' },
  },
  gather: {
    python: 'np.asarray', args: 'passthrough', imports: ['numpy'], toolbox: 'Parallel Computing',
    flag: { type: 'WARNING', message: 'gather → np.asarray covers the CPU case; for CuPy arrays use x.get() instead.' },
  },

  // Wavelet (pywt)
  wfilters: {
    python: 'wfilters', args: 'passthrough', imports: [], toolbox: 'Wavelet',
    flag: { type: 'TODO', message: "wfilters('db4') → pywt.Wavelet('db4').filter_bank (returns (lo_d, hi_d, lo_r, hi_r))." },
  },
  modwt: {
    python: 'pywt.swt', args: 'passthrough', imports: ['pywt'], toolbox: 'Wavelet',
    flag: { type: 'WARNING', message: 'modwt ≈ pywt.swt (stationary transform) — boundary handling and normalization differ.' },
  },
  imodwt: {
    python: 'pywt.iswt', args: 'passthrough', imports: ['pywt'], toolbox: 'Wavelet',
    flag: { type: 'WARNING', message: 'imodwt ≈ pywt.iswt — pair with pywt.swt.' },
  },
  wdenoise: {
    python: 'wdenoise', args: 'passthrough', imports: [], toolbox: 'Wavelet',
    flag: { type: 'TODO', message: 'wdenoise → pywt.wavedec + pywt.threshold on detail coeffs + pywt.waverec.' },
  },
  appcoef: {
    python: 'appcoef', args: 'passthrough', imports: [], toolbox: 'Wavelet',
    flag: { type: 'TODO', message: 'appcoef → coeffs[0] from pywt.wavedec (approximation coefficients).' },
  },
  detcoef: {
    python: 'detcoef', args: 'passthrough', imports: [], toolbox: 'Wavelet',
    flag: { type: 'TODO', message: 'detcoef(c, l, k) → coeffs[-k] from pywt.wavedec (detail coefficients at level k).' },
  },
  wrcoef: {
    python: 'wrcoef', args: 'passthrough', imports: [], toolbox: 'Wavelet',
    flag: { type: 'TODO', message: 'wrcoef → pywt.waverec on a coeff list with the other levels zeroed.' },
  },
  waveinfo: {
    python: 'waveinfo', args: 'passthrough', imports: [], toolbox: 'Wavelet',
    flag: { type: 'TODO', message: "waveinfo('db') → print(pywt.Wavelet('db4')) / pywt.wavelist('db')." },
  },
  
  // Instrument Control / Data Acquisition
  serial: {
    python: 'serial', args: 'passthrough', imports: [], toolbox: 'Instrument Control',
    flag: { type: 'UNSUPPORTED', message: 'serial communication is unsupported by default. Use the Python pyserial package (serial.Serial) to interact with serial ports.' },
  },
  gpib: {
    python: 'gpib', args: 'passthrough', imports: [], toolbox: 'Instrument Control',
    flag: { type: 'UNSUPPORTED', message: 'gpib control is unsupported. Install pyvisa (pip install pyvisa) to interact with GPIB/VISA instruments.' },
  },
  daq: {
    python: 'daq', args: 'passthrough', imports: [], toolbox: 'Data Acquisition',
    flag: { type: 'UNSUPPORTED', message: 'daq is unsupported. Use NI-DAQmx Python bindings (nidaqmx) or PyDAQmx to interact with data acquisition hardware.' },
  },

  // App Designer / GUI
  uifigure: {
    python: 'uifigure', args: 'passthrough', imports: [], toolbox: 'GUI',
    flag: { type: 'UNSUPPORTED', message: 'uifigure creates a MATLAB App Designer UI window — no Python equivalent. Reimplement using a Python GUI toolkit like PyQt6/PySide6 (QMainWindow) or tkinter.' },
  },
  uicontrol: {
    python: 'uicontrol', args: 'passthrough', imports: [], toolbox: 'GUI',
    flag: { type: 'UNSUPPORTED', message: 'uicontrol creates legacy MATLAB UI controls — no Python equivalent. Reimplement using widgets in PyQt6/PySide6 (QPushButton, etc.) or tkinter.' },
  },
  msgbox: {
    python: 'msgbox', args: 'passthrough', imports: [], toolbox: 'GUI',
    flag: { type: 'TODO', message: 'msgbox displays a popup dialog — use tkinter.messagebox.showinfo() or PyQt QMessageBox.' },
  },
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
