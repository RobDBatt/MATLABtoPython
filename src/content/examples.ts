/**
 * Canonical MATLAB-to-Python conversion examples.
 *
 * Each example stores the MATLAB source only. The Python output is
 * generated at build time by running the source through the same
 * converter the public uses at /convert. That way the examples are
 * always in sync with the current engine — as the converter improves,
 * the example pages update automatically.
 */

export interface Example {
  slug: string
  title: string
  /** One-liner for the grid card and meta description */
  summary: string
  /** Longer explanation shown above the side-by-side code */
  context: string
  /** Which domain this belongs to — used for filtering and SEO grouping */
  tags: string[]
  /** Raw MATLAB source. Runs through the converter at build time. */
  matlab: string
  /**
   * Short notes to display under the Python output — typical gotchas,
   * imports to be aware of, and whether the output needs the
   * matlabtopython-compat runtime package.
   */
  notes?: string
}

export const EXAMPLES: Example[] = [
  {
    slug: 'butterworth-lowpass-filter',
    title: 'Butterworth Lowpass Filter',
    summary: 'Design a 4th-order Butterworth filter and apply it with zero-phase filtfilt — the canonical Signal Processing Toolbox use case.',
    context:
      'This is the most common MATLAB snippet an engineer translates first. Designs a 4th-order lowpass Butterworth at a normalized cutoff, then applies zero-phase filtering to avoid the phase distortion of plain `filter`. Both the filter design and the filtfilt behavior map 1:1 to `scipy.signal`.',
    tags: ['signal-processing'],
    matlab: `% Lowpass filter a noisy signal
fs = 1000;              % sample rate, Hz
fc = 80;                % cutoff, Hz
t = 0:1/fs:1;           % 1 second of samples
x = sin(2*pi*5*t) + 0.5*randn(size(t));

[b, a] = butter(4, fc/(fs/2));
y = filtfilt(b, a, x);

figure
plot(t, x, 'b', 'LineWidth', 0.5); hold on;
plot(t, y, 'r', 'LineWidth', 1.5);
xlabel('time (s)'); ylabel('amplitude');
title('Butterworth lowpass');
legend('noisy', 'filtered');
grid on;`,
    notes:
      "scipy.signal.butter uses the same normalization (Wn as fraction of Nyquist). The filtfilt call matches byte-for-byte. Needs `pip install scipy matplotlib numpy`.",
  },
  {
    slug: 'fft-frequency-spectrum',
    title: 'FFT Frequency Spectrum',
    summary: 'Compute a single-sided amplitude spectrum using FFT — the tutorial everyone writes when they start with signal processing.',
    context:
      "MATLAB's `fft` and numpy's `np.fft.fft` produce the same output ordering. The common recipe — take the absolute value, keep the one-sided half, scale by 2/N — translates directly. Only footgun: MATLAB's 1-based indexing in `X(1:N/2)` becomes `X[:N//2]` in Python.",
    tags: ['signal-processing'],
    matlab: `% Single-sided amplitude spectrum
fs = 1000;
t = 0:1/fs:1-1/fs;
x = 0.7*sin(2*pi*50*t) + sin(2*pi*120*t);
N = length(x);

X = fft(x);
P2 = abs(X/N);
P1 = P2(1:N/2+1);
P1(2:end-1) = 2*P1(2:end-1);

f = fs*(0:(N/2))/N;
figure
plot(f, P1);
xlabel('Frequency (Hz)'); ylabel('|X(f)|');
title('Single-sided amplitude spectrum');
grid on;`,
    notes: 'Pure NumPy — no scipy needed. np.fft.fft matches MATLAB ordering exactly.',
  },
  {
    slug: 'peak-detection',
    title: 'Peak Detection',
    summary: 'Find local maxima above a threshold with findpeaks — heart-rate detection, spike counting, spectral peaks.',
    context:
      "MATLAB's `findpeaks` returns peaks and locations as separate outputs; scipy's `find_peaks` returns only locations and you index the signal for values. Location indices are 0-based in scipy — useful when using them as numpy indices downstream, but careful when comparing to MATLAB's 1-based plot annotations.",
    tags: ['signal-processing'],
    matlab: `% Detect peaks in a noisy signal
t = 0:0.01:10;
x = sin(t) + 0.2*sin(3*t) + 0.1*randn(size(t));

[peaks, locs] = findpeaks(x, 'MinPeakHeight', 0.5, 'MinPeakDistance', 30);

figure
plot(t, x, 'b'); hold on;
plot(t(locs), peaks, 'rv', 'MarkerSize', 10);
xlabel('time'); ylabel('amplitude');
title(sprintf('Found %d peaks', length(peaks)));
grid on;`,
    notes: 'scipy.signal.find_peaks uses keyword args instead of name-value pairs — the converter handles the rename automatically.',
  },
  {
    slug: 'linear-regression',
    title: 'Linear Regression',
    summary: 'Fit a linear model and plot the residuals — the simplest fitting example, and what most people actually need.',
    context:
      "MATLAB's `polyfit(x, y, 1)` and numpy's `np.polyfit(x, y, 1)` are identical. The residuals and R² calculation requires a couple of extra steps in Python since MATLAB bakes them into the `fit` object, but numpy's vectorized math makes it easy.",
    tags: ['statistics', 'curve-fitting'],
    matlab: `% Fit a line to noisy data and report R^2
x = linspace(0, 10, 50)';
y = 2.5*x + 3 + randn(size(x));

p = polyfit(x, y, 1);
y_fit = polyval(p, x);
ss_res = sum((y - y_fit).^2);
ss_tot = sum((y - mean(y)).^2);
r_squared = 1 - ss_res/ss_tot;

figure
plot(x, y, 'ko'); hold on;
plot(x, y_fit, 'r-', 'LineWidth', 2);
xlabel('x'); ylabel('y');
title(sprintf('y = %.2fx + %.2f, R^2 = %.3f', p(1), p(2), r_squared));
legend('data', 'fit');
grid on;`,
  },
  {
    slug: 'image-threshold',
    title: 'Image Threshold and Region Labeling',
    summary: "Read an image, threshold it, label connected components — the 'hello world' of Image Processing Toolbox.",
    context:
      'The Image Processing Toolbox functions `imread`, `rgb2gray`, `imbinarize`, and `bwlabel` map to scikit-image and scipy.ndimage equivalents. The mapping is straightforward; the main difference is that scikit-image returns float images in [0, 1] by default where MATLAB returns uint8 in [0, 255].',
    tags: ['image-processing'],
    matlab: `% Threshold an image and count blobs
img = imread('cells.png');
gray = rgb2gray(img);
bw = imbinarize(gray);
[labeled, n] = bwlabel(bw);

figure
subplot(1, 3, 1); imshow(gray); title('grayscale');
subplot(1, 3, 2); imshow(bw); title('binary');
subplot(1, 3, 3); imshow(label2rgb(labeled)); title([num2str(n), ' regions']);`,
    notes:
      'The output uses `skimage.io.imread` and `skimage.measure.label`. If you call it with a URL, you may need `skimage.io.imread(url, plugin="imageio")` depending on your scikit-image version.',
  },
  {
    slug: 'ode45-differential-equation',
    title: 'ODE45 — Solve an ODE',
    summary: 'Solve a damped harmonic oscillator with ode45 — the workhorse of engineering coursework.',
    context:
      "MATLAB's `ode45` maps to `scipy.integrate.solve_ivp` with method='RK45'. The argument order differs: MATLAB takes `(odefun, tspan, y0)`, scipy takes `(fun, t_span, y0)`. The converter handles the swap. Output access changes too — MATLAB gives `[t, y]` arrays; scipy wraps them in a `sol` object with `.t` and `.y` attributes.",
    tags: ['numerical', 'optimization'],
    matlab: `% Damped harmonic oscillator
% y'' + 0.2 y' + y = 0
f = @(t, y) [y(2); -0.2*y(2) - y(1)];

[t, y] = ode45(f, [0 30], [1; 0]);

figure
plot(t, y(:, 1), 'b-', 'LineWidth', 1.5);
xlabel('time'); ylabel('position');
title('Damped oscillator');
grid on;`,
    notes: "scipy's solve_ivp returns a solution object. Access as `sol.t` and `sol.y[0]` instead of MATLAB's `t` and `y(:,1)`.",
  },
  {
    slug: 'monte-carlo-pi',
    title: 'Monte Carlo Estimation of π',
    summary: 'The classic Monte Carlo — sample points in a unit square and count how many fall in the inscribed circle.',
    context:
      'Almost pure vectorized array math. `rand` maps to `np.random.rand`, logical indexing and `sum` work the same way. The MATLAB row-vs-column vector convention doesn\'t matter here — everything is scalar at the end.',
    tags: ['statistics', 'vectorization'],
    matlab: `% Estimate pi by sampling
N = 1e6;
x = rand(N, 1);
y = rand(N, 1);
inside = (x.^2 + y.^2) <= 1;
pi_est = 4 * sum(inside) / N;

fprintf('With %d samples, pi ≈ %.6f (error: %.6f)\\n', ...
    N, pi_est, abs(pi_est - pi));`,
    notes: 'Pure numpy. No plotting, fast to run.',
  },
  {
    slug: 'kmeans-clustering',
    title: 'K-Means Clustering',
    summary: "Cluster 2D points with MATLAB's kmeans — the simplest entry into the Statistics Toolbox.",
    context:
      "MATLAB's `kmeans(X, K)` returns `[idx, C]` — the cluster assignment per row and the centroid matrix. scikit-learn's `KMeans(n_clusters=K).fit(X)` returns an object with `.labels_` and `.cluster_centers_`. Same data, different idioms. The converter flags this one for manual review because the output shape isn't a 1:1 swap.",
    tags: ['statistics', 'machine-learning'],
    matlab: `% K-means on 2D Gaussian blobs
rng(42);
X = [randn(100, 2) + 2; randn(100, 2) - 2; randn(100, 2) + [4 -2]];

[idx, C] = kmeans(X, 3);

figure
gscatter(X(:, 1), X(:, 2), idx); hold on;
plot(C(:, 1), C(:, 2), 'kx', 'MarkerSize', 15, 'LineWidth', 3);
title('K-means clusters with centroids');`,
    notes:
      "The converter flags kmeans with a TODO because scikit-learn's KMeans API doesn't match MATLAB's call signature. The output suggests `from sklearn.cluster import KMeans; km = KMeans(n_clusters=3).fit(X); idx = km.labels_; C = km.cluster_centers_`.",
  },
  {
    slug: 'matrix-linear-solve',
    title: 'Linear System Ax = b',
    summary: "MATLAB's backslash operator `A\\b` — solve a linear system the way every engineer learned.",
    context:
      'The backslash operator is where MATLAB is at its most elegant. `np.linalg.solve(A, b)` does the same thing with a function call. For over- or under-determined systems, MATLAB transparently switches between LU, QR, and least-squares; numpy requires you to know which solver you want. Our converter picks `solve` for square systems and flags non-square with a TODO.',
    tags: ['linear-algebra'],
    matlab: `% Solve a system of linear equations
A = [3 2 -1; 2 -2 4; -1 0.5 -1];
b = [1; -2; 0];

x = A \\ b;

fprintf('Solution: x = [%.4f, %.4f, %.4f]\\n', x(1), x(2), x(3));
fprintf('Residual: %.2e\\n', norm(A*x - b));`,
    notes:
      "np.linalg.solve requires a square matrix. For rectangular A, use np.linalg.lstsq(A, b, rcond=None)[0].",
  },
  {
    slug: 'multiple-return-sort',
    title: 'Sort with Indices',
    summary: "[sorted_vals, idx] = sort(X) — one of those MATLAB idioms that breaks when ported naively.",
    context:
      "MATLAB's `sort` returns both the sorted values and the original indices that produce that order. `np.sort` returns only values; `np.argsort` returns only indices. Neither is a drop-in. The converter recognizes the `[A, I] = sort(X)` idiom and rewrites to `A, I = sort_with_index(X)` — a helper in the matlabtopython-compat package that returns the pair MATLAB-style. `pip install matlabtopython-compat` and the import is added automatically.",
    tags: ['arrays', 'idioms'],
    matlab: `% Rank elements by value
scores = [87, 62, 95, 78, 85];
names = {'Alice', 'Bob', 'Carol', 'Dan', 'Eve'};

[sorted_scores, rank] = sort(scores, 'descend');

for i = 1:length(sorted_scores)
    fprintf('%d. %s: %d\\n', i, names{rank(i)}, sorted_scores(i));
end`,
    notes:
      'Uses the matlabtopython-compat runtime shim for sort_with_index. `pip install matlabtopython-compat` before running the output.',
  },
]

export function getExample(slug: string) {
  return EXAMPLES.find(e => e.slug === slug)
}

export function getAllExampleSlugs() {
  return EXAMPLES.map(e => e.slug)
}
