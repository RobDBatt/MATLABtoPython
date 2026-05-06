export const article = {
  slug: 'matlab-signal-processing-to-scipy',
  title: 'MATLAB Signal Processing Toolbox to SciPy: Complete Function Reference',
  description: 'Every MATLAB Signal Processing Toolbox function mapped to its scipy.signal equivalent. Filter design, spectral analysis, convolution, transforms — with the gotchas that cause silent bugs.',
  publishedAt: '2026-04-17',
  keyword: 'matlab signal processing toolbox python',
  sections: [
    {
      heading: 'The single most important gotcha',
      body: `**MATLAB and scipy.signal use different frequency conventions in their filter design functions.**

In MATLAB's \`butter(N, Wn)\`, the cutoff \`Wn\` is **normalized by the Nyquist frequency** — it's a value between 0 and 1 where 1 means the Nyquist frequency (fs/2).

In scipy.signal's \`butter(N, Wn)\`, by default \`Wn\` is also normalized the same way **as a proportion of the Nyquist frequency**, so if you already compute \`Wn = fc/(fs/2)\` in MATLAB you can pass the same number through.

But there's a trap: scipy.signal also accepts a \`fs=\` parameter, in which case \`Wn\` becomes an absolute frequency in Hz. If you port MATLAB code that assumes normalized Wn but you add \`fs=fs\` later, your filter cutoff becomes wrong by a factor of \`fs/2\`.

Concrete example:
\`\`\`matlab
% MATLAB — cutoff at 100 Hz with fs = 1000
[b, a] = butter(4, 100 / (fs/2));
\`\`\`

\`\`\`python
# scipy.signal — same thing, same numbers
from scipy import signal
b, a = signal.butter(4, 100 / (fs/2))

# OR, equivalently, with the fs= parameter (absolute Hz):
b, a = signal.butter(4, 100, fs=fs)
\`\`\`

The second form is less error-prone. Pick one convention and stick with it.`,
    },
    {
      heading: 'Filter design',
      body: `| MATLAB | scipy.signal |
|---|---|
| \`butter(N, Wn)\` | \`signal.butter(N, Wn)\` |
| \`butter(N, Wn, 'high')\` | \`signal.butter(N, Wn, 'high')\` |
| \`butter(N, [Wlow Whigh])\` | \`signal.butter(N, [Wlow, Whigh])\` (bandpass) |
| \`cheby1(N, Rp, Wn)\` | \`signal.cheby1(N, Rp, Wn)\` |
| \`cheby2(N, Rs, Wn)\` | \`signal.cheby2(N, Rs, Wn)\` |
| \`ellip(N, Rp, Rs, Wn)\` | \`signal.ellip(N, Rp, Rs, Wn)\` |
| \`besself(N, Wn)\` | \`signal.bessel(N, Wn)\` (note: \`bessel\`, not \`besself\`) |
| \`buttord(Wp, Ws, Rp, Rs)\` | \`signal.buttord(Wp, Ws, Rp, Rs)\` |

All of these return \`(b, a)\` tuples in the same order MATLAB does. Bandpass and bandstop take a 2-element vector of cutoffs, same as MATLAB. Filter type strings (\`'low'\`, \`'high'\`, \`'bandpass'\`, \`'stop'\`) match.`,
    },
    {
      heading: 'Applying filters',
      body: `| MATLAB | scipy.signal | Notes |
|---|---|---|
| \`filter(b, a, x)\` | \`signal.lfilter(b, a, x)\` | **Note:** \`lfilter\`, not \`filter\` |
| \`filtfilt(b, a, x)\` | \`signal.filtfilt(b, a, x)\` | Zero-phase, same algorithm |
| \`conv(a, b)\` | \`np.convolve(a, b)\` | NumPy, not scipy |
| \`conv2(A, B)\` | \`signal.convolve2d(A, B)\` | |
| \`fftfilt(b, x)\` | \`signal.fftconvolve(b, x, mode='same')\` | Uses FFT for long filters |

The name change from \`filter\` to \`lfilter\` trips everyone. Python already has a built-in \`filter\` function (for iterables); scipy renamed the DSP version to avoid the clash.

**Key behavior match:** \`filtfilt\` in both libraries uses the same padding strategy and produces identical output for the same inputs. \`lfilter\` matches \`filter\` exactly.`,
    },
    {
      heading: 'Spectral analysis',
      body: `| MATLAB | scipy.signal / numpy | Notes |
|---|---|---|
| \`fft(x)\` | \`np.fft.fft(x)\` | Identical output, identical ordering |
| \`ifft(X)\` | \`np.fft.ifft(X)\` | |
| \`fft2(A)\` | \`np.fft.fft2(A)\` | |
| \`fftshift(X)\` | \`np.fft.fftshift(X)\` | |
| \`ifftshift(X)\` | \`np.fft.ifftshift(X)\` | |
| \`pwelch(x, window, noverlap, nfft, fs)\` | \`signal.welch(x, fs=fs, window=window, noverlap=noverlap, nperseg=nfft)\` | Note: \`welch\`, not \`pwelch\` |
| \`periodogram(x, window, nfft, fs)\` | \`signal.periodogram(x, fs=fs, window=window, nfft=nfft)\` | |
| \`spectrogram(x, window, noverlap, nfft, fs)\` | \`signal.spectrogram(x, fs=fs, window=window, noverlap=noverlap, nperseg=nfft)\` | |
| \`cpsd(x, y)\` | \`signal.csd(x, y)\` | Cross power spectral density |
| \`mscohere(x, y)\` | \`signal.coherence(x, y)\` | Magnitude-squared coherence |

**Frequency output differences:**
- \`pwelch\` in MATLAB returns the **one-sided** PSD by default (half-spectrum for real inputs, scaled appropriately).
- \`signal.welch\` in scipy matches this default. No conversion needed.
- But \`np.fft.fft(x)\` returns the **two-sided** spectrum. If you need one-sided, take \`X[:N//2]\` and multiply by 2 (except DC and Nyquist).`,
    },
    {
      heading: 'Window functions',
      body: `| MATLAB | scipy.signal.windows |
|---|---|
| \`hamming(N)\` | \`signal.windows.hamming(N)\` |
| \`hanning(N)\` | \`signal.windows.hann(N)\` (note: \`hann\`, not \`hanning\`) |
| \`blackman(N)\` | \`signal.windows.blackman(N)\` |
| \`kaiser(N, beta)\` | \`signal.windows.kaiser(N, beta)\` |
| \`gausswin(N)\` | \`signal.windows.gaussian(N, std)\` |
| \`tukeywin(N, r)\` | \`signal.windows.tukey(N, r)\` |
| \`bartlett(N)\` | \`signal.windows.bartlett(N)\` |

**Note:** MATLAB's \`hanning\` and scipy's \`hann\` compute slightly different arrays. MATLAB's \`hanning(N)\` zero-fills the endpoints; scipy's \`hann(N)\` does not. For \`N\` beyond ~32, the difference is negligible, but for short windows you may see mismatches. Use \`signal.windows.hann(N, sym=True)\` to force symmetric form.`,
    },
    {
      heading: 'Resampling and rate conversion',
      body: `| MATLAB | scipy.signal |
|---|---|
| \`resample(x, p, q)\` | \`signal.resample_poly(x, p, q)\` |
| \`decimate(x, r)\` | \`signal.decimate(x, r)\` |
| \`upsample(x, n)\` | \`signal.resample_poly(x, n, 1)\` or manual zero-insertion |
| \`downsample(x, n)\` | \`x[::n]\` |
| \`interp(x, n)\` | \`signal.resample_poly(x, n, 1)\` |

\`resample_poly\` uses polyphase filtering and matches MATLAB's behavior. Use it instead of scipy's plain \`resample\`, which uses FFT-based resampling with different edge artifacts.`,
    },
    {
      heading: 'Frequency response analysis',
      body: `| MATLAB | scipy.signal |
|---|---|
| \`freqz(b, a)\` | \`signal.freqz(b, a)\` |
| \`freqz(b, a, N)\` | \`signal.freqz(b, a, N)\` |
| \`freqz(b, a, N, fs)\` | \`signal.freqz(b, a, N, fs=fs)\` |
| \`[h, w] = freqz(...)\` | \`w, h = signal.freqz(...)\` (note: order swap!) |
| \`impz(b, a)\` | \`signal.dimpulse((b, a, 1))\` or manual \`lfilter\` with delta input |

The output order is **swapped**: MATLAB returns \`[h, w]\` (response, frequency), scipy returns \`(w, h)\`. Miss that swap and your Bode plots look like nonsense.`,
    },
    {
      heading: 'Correlation and transforms',
      body: `| MATLAB | scipy.signal / numpy |
|---|---|
| \`xcorr(a, b)\` | \`np.correlate(a, b, 'full')\` |
| \`xcorr(a, b, maxlag)\` | Compute \`np.correlate\` then slice to ±maxlag |
| \`hilbert(x)\` | \`signal.hilbert(x)\` |
| \`dct(x)\` | \`scipy.fft.dct(x)\` |
| \`idct(X)\` | \`scipy.fft.idct(X)\` |
| \`czt(x, M, W, A)\` | \`signal.czt(x, M, W, A)\` |

**xcorr normalization:** MATLAB's \`xcorr(a, b, 'normalized')\` scales by the geometric mean of autocorrelations at zero lag. Numpy's \`correlate\` does no normalization by default — you have to divide manually.`,
    },
    {
      heading: 'Peak detection',
      body: `\`\`\`matlab
[pks, locs] = findpeaks(x, 'MinPeakHeight', h, 'MinPeakDistance', d)
\`\`\`

\`\`\`python
from scipy.signal import find_peaks
locs, properties = find_peaks(x, height=h, distance=d)
pks = x[locs]
\`\`\`

Two big differences:

1. MATLAB returns peaks and locations as separate outputs. Scipy returns only locations; you index \`x\` to get peak values.
2. MATLAB locations are 1-indexed; scipy is 0-indexed (standard Python). Our converter shifts these when needed.

Option name changes:
| MATLAB | scipy |
|---|---|
| \`'MinPeakHeight'\` | \`height=\` |
| \`'MinPeakProminence'\` | \`prominence=\` |
| \`'MinPeakDistance'\` | \`distance=\` |
| \`'MinPeakWidth'\` | \`width=\` |
| \`'Threshold'\` | \`threshold=\` |`,
    },
    {
      heading: 'Should you pip install scipy before or after converting?',
      body: `Before. If you paste MATLAB code containing \`butter\`, \`filtfilt\`, \`fft\`, etc., [the converter](/convert) automatically emits \`from scipy import signal\` at the top and applies all the mappings in this article. You just need scipy installed (\`pip install scipy\`) to run the output.

The converter also flags any Signal Processing Toolbox function that doesn't have a clean scipy equivalent (there are a handful — mostly newer MATLAB additions like \`wavelet-style\` filterbanks). Those get a TODO comment so you know exactly where to intervene.`,
    },
  ],
}
