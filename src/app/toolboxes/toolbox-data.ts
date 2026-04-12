export interface ToolboxInfo {
  slug: string
  name: string
  matlabName: string
  pythonLib: string
  installCmd: string
  description: string
  mappings: Array<{ matlab: string; python: string; note?: string }>
}

export const TOOLBOXES: ToolboxInfo[] = [
  {
    slug: 'signal-processing',
    name: 'Signal Processing',
    matlabName: 'Signal Processing Toolbox',
    pythonLib: 'scipy.signal',
    installCmd: 'pip install scipy',
    description: 'Filter design, spectral analysis, and signal transforms. The most commonly migrated MATLAB toolbox.',
    mappings: [
      { matlab: 'butter(n, Wn)', python: 'signal.butter(n, Wn)', note: 'Butterworth filter design' },
      { matlab: 'cheby1(n, Rp, Wn)', python: 'signal.cheby1(n, Rp, Wn)', note: 'Chebyshev Type I' },
      { matlab: 'cheby2(n, Rs, Wn)', python: 'signal.cheby2(n, Rs, Wn)', note: 'Chebyshev Type II' },
      { matlab: 'ellip(n, Rp, Rs, Wn)', python: 'signal.ellip(n, Rp, Rs, Wn)', note: 'Elliptic filter' },
      { matlab: 'filtfilt(b, a, x)', python: 'signal.filtfilt(b, a, x)', note: 'Zero-phase filtering' },
      { matlab: 'filter(b, a, x)', python: 'signal.lfilter(b, a, x)', note: 'Note: lfilter, not filter' },
      { matlab: 'freqz(b, a)', python: 'signal.freqz(b, a)', note: 'Frequency response' },
      { matlab: 'spectrogram(x)', python: 'signal.spectrogram(x)' },
      { matlab: 'pwelch(x)', python: 'signal.welch(x)', note: 'Note: welch, not pwelch' },
      { matlab: 'periodogram(x)', python: 'signal.periodogram(x)' },
      { matlab: 'resample(x, p, q)', python: 'signal.resample_poly(x, p, q)' },
      { matlab: 'decimate(x, r)', python: 'signal.decimate(x, r)' },
      { matlab: 'hilbert(x)', python: 'signal.hilbert(x)' },
      { matlab: 'conv(a, b)', python: 'np.convolve(a, b)', note: 'Uses NumPy, not SciPy' },
      { matlab: 'conv2(A, B)', python: 'signal.convolve2d(A, B)' },
      { matlab: 'xcorr(a, b)', python: "np.correlate(a, b, 'full')" },
    ],
  },
  {
    slug: 'statistics',
    name: 'Statistics',
    matlabName: 'Statistics and Machine Learning Toolbox',
    pythonLib: 'scipy.stats + pandas',
    installCmd: 'pip install scipy pandas',
    description: 'Statistical distributions, hypothesis testing, and regression. Maps to scipy.stats and pandas.',
    mappings: [
      { matlab: 'normpdf(x, mu, sig)', python: 'stats.norm.pdf(x, mu, sig)' },
      { matlab: 'normcdf(x, mu, sig)', python: 'stats.norm.cdf(x, mu, sig)' },
      { matlab: 'norminv(p, mu, sig)', python: 'stats.norm.ppf(p, mu, sig)' },
      { matlab: 'normrnd(mu, sig, m, n)', python: 'np.random.normal(mu, sig, (m, n))' },
      { matlab: 'ttest(x)', python: 'stats.ttest_1samp(x, 0)' },
      { matlab: 'ttest2(x, y)', python: 'stats.ttest_ind(x, y)' },
      { matlab: 'anova1(data)', python: 'stats.f_oneway(*groups)' },
      { matlab: 'chi2test(x)', python: 'stats.chi2_contingency(x)' },
      { matlab: 'corrcoef(X)', python: 'np.corrcoef(X)' },
      { matlab: 'cov(X)', python: 'np.cov(X)' },
      { matlab: 'polyfit(x, y, n)', python: 'np.polyfit(x, y, n)' },
      { matlab: 'polyval(p, x)', python: 'np.polyval(p, x)' },
      { matlab: 'tabulate(x)', python: 'pd.value_counts(x)' },
      { matlab: 'quantile(x, p)', python: 'np.quantile(x, p)' },
      { matlab: 'prctile(x, p)', python: 'np.percentile(x, p)' },
    ],
  },
  {
    slug: 'image-processing',
    name: 'Image Processing',
    matlabName: 'Image Processing Toolbox',
    pythonLib: 'scikit-image + scipy.ndimage',
    installCmd: 'pip install scikit-image',
    description: 'Image filtering, segmentation, and morphological operations. Maps to scikit-image and OpenCV.',
    mappings: [
      { matlab: "imread('file')", python: "io.imread('file')" },
      { matlab: "imwrite(I, 'file')", python: "io.imsave('file', I)", note: 'Argument order reversed' },
      { matlab: 'imshow(I)', python: 'plt.imshow(I)', note: 'Uses matplotlib' },
      { matlab: 'imresize(I, [m,n])', python: 'transform.resize(I, (m,n))' },
      { matlab: 'imrotate(I, angle)', python: 'transform.rotate(I, angle)' },
      { matlab: 'rgb2gray(I)', python: 'color.rgb2gray(I)' },
      { matlab: 'im2double(I)', python: 'util.img_as_float(I)' },
      { matlab: 'imfilter(I, h)', python: 'ndi.convolve(I, h)', note: 'Uses scipy.ndimage' },
      { matlab: "edge(I, 'canny')", python: 'feature.canny(I)' },
      { matlab: 'regionprops(L)', python: 'measure.regionprops(L)' },
      { matlab: 'bwlabel(BW)', python: 'measure.label(BW)' },
      { matlab: 'imdilate(BW, se)', python: 'morphology.dilation(BW, se)' },
      { matlab: 'imerode(BW, se)', python: 'morphology.erosion(BW, se)' },
    ],
  },
  {
    slug: 'optimization',
    name: 'Optimization',
    matlabName: 'Optimization Toolbox',
    pythonLib: 'scipy.optimize',
    installCmd: 'pip install scipy',
    description: 'Nonlinear optimization, root finding, and linear programming. Maps to scipy.optimize.',
    mappings: [
      { matlab: 'fminunc(f, x0)', python: 'optimize.minimize(f, x0)' },
      { matlab: 'fminsearch(f, x0)', python: "optimize.minimize(f, x0, method='Nelder-Mead')" },
      { matlab: 'fmincon(f, x0, A, b)', python: 'optimize.minimize(f, x0, constraints=...)', note: 'Constraints need manual mapping' },
      { matlab: 'fzero(f, x0)', python: 'optimize.brentq(f, a, b)', note: 'Requires interval [a,b] instead of initial guess' },
      { matlab: 'fsolve(f, x0)', python: 'optimize.fsolve(f, x0)' },
      { matlab: 'lsqcurvefit(f, p, x, y)', python: 'optimize.curve_fit(f, x, y, p)' },
      { matlab: 'linprog(f, A, b)', python: 'optimize.linprog(f, A_ub=A, b_ub=b)' },
    ],
  },
  {
    slug: 'control-systems',
    name: 'Control Systems',
    matlabName: 'Control System Toolbox',
    pythonLib: 'python-control',
    installCmd: 'pip install control',
    description: 'Transfer functions, state space models, and frequency domain analysis. Maps to python-control.',
    mappings: [
      { matlab: 'tf(num, den)', python: 'control.tf(num, den)' },
      { matlab: 'ss(A, B, C, D)', python: 'control.ss(A, B, C, D)' },
      { matlab: 'zpk(z, p, k)', python: 'control.zpk(z, p, k)' },
      { matlab: 'bode(sys)', python: 'control.bode_plot(sys)' },
      { matlab: 'nyquist(sys)', python: 'control.nyquist_plot(sys)' },
      { matlab: 'step(sys)', python: 'control.step_response(sys)' },
      { matlab: 'impulse(sys)', python: 'control.impulse_response(sys)' },
      { matlab: 'rlocus(sys)', python: 'control.root_locus(sys)' },
      { matlab: 'margin(sys)', python: 'control.margin(sys)' },
      { matlab: 'feedback(G, H)', python: 'control.feedback(G, H)' },
      { matlab: 'series(G1, G2)', python: 'control.series(G1, G2)' },
      { matlab: 'parallel(G1, G2)', python: 'control.parallel(G1, G2)' },
      { matlab: 'c2d(sys, Ts)', python: 'control.c2d(sys, Ts)' },
    ],
  },
]

export function getToolbox(slug: string): ToolboxInfo | undefined {
  return TOOLBOXES.find(t => t.slug === slug)
}
