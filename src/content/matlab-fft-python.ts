export const article = {
  slug: 'matlab-fft-python',
  title: 'MATLAB fft to Python: np.fft.fft, normalization, and fftshift',
  description:
    'Convert MATLAB fft to Python with numpy.fft. Covers the normalization myth, the frequency axis with fftfreq, fftshift for centering, and rfft for real signals.',
  publishedAt: '2026-06-26',
  keyword: 'matlab fft python',
  sections: [
    {
      heading: 'The direct replacement: numpy.fft.fft',
      body: `MATLAB's \`fft\` maps directly to NumPy's \`np.fft.fft\`. The companion functions line up one-to-one:

| MATLAB | NumPy |
|---|---|
| \`fft(x)\` | \`np.fft.fft(x)\` |
| \`ifft(X)\` | \`np.fft.ifft(X)\` |
| \`fft2(x)\` | \`np.fft.fft2(x)\` |
| \`fftshift(X)\` | \`np.fft.fftshift(X)\` |
| \`abs(X)\` | \`np.abs(X)\` |

\`\`\`matlab
% MATLAB
x = [1 2 3 4 3 2 1 0];
y   = fft(x);
mag = abs(y);
Y   = fftshift(fft(x));
\`\`\`

\`\`\`python
# Python
import numpy as np

x   = np.array([1, 2, 3, 4, 3, 2, 1, 0])
y   = np.fft.fft(x)
mag = np.abs(y)
Y   = np.fft.fftshift(np.fft.fft(x))
\`\`\`

The output is a complex array in both languages, with the same length as the input.`,
    },
    {
      heading: 'The normalization "gotcha" is mostly a myth',
      body: `You will read that NumPy and MATLAB normalize the FFT differently. For the **default** transform, they don't — they use the exact same convention:

- **Forward (\`fft\`)**: unnormalized in both. \`np.fft.fft(x)\` returns the same numbers as MATLAB's \`fft(x)\`.
- **Inverse (\`ifft\`)**: scaled by \`1/N\` in both.

So a plain \`fft\`/\`ifft\` round-trip matches MATLAB out of the box — no rescaling needed.

The only time normalization bites you is if your MATLAB code (or the Python you're porting *to*) used a non-default scaling. NumPy exposes it via the \`norm\` argument: \`norm='backward'\` (default, matches MATLAB), \`norm='ortho'\` (1/√N on both directions), or \`norm='forward'\` (1/N on the forward transform). Leave it at the default and you match MATLAB.`,
    },
    {
      heading: 'Building the frequency axis',
      body: `MATLAB code usually builds the frequency vector by hand. NumPy gives you \`fftfreq\` to do it correctly, including the negative frequencies:

\`\`\`matlab
% MATLAB
N  = length(x);
f  = (0:N-1) * (Fs / N);          % one-sided-ish, 0..Fs
\`\`\`

\`\`\`python
# Python
N = len(x)
f = np.fft.fftfreq(N, d=1/Fs)     # [0, +, ..., -, ...] in Hz
\`\`\`

\`fftfreq\` returns frequencies in the **same order as \`fft\`** — zero first, then positive, then negative. To get a centered spectrum for plotting, apply \`fftshift\` to *both* the frequencies and the transform:

\`\`\`python
f_c = np.fft.fftshift(np.fft.fftfreq(N, d=1/Fs))
Y_c = np.fft.fftshift(np.fft.fft(x))
# now plot(f_c, np.abs(Y_c)) is centered on 0 Hz
\`\`\``,
    },
    {
      heading: 'Real signals: use rfft',
      body: `MATLAB's \`fft\` always returns the full, symmetric spectrum even for real input. If your signal is real, NumPy's \`np.fft.rfft\` returns just the non-redundant half — faster and half the memory:

\`\`\`python
Yr = np.fft.rfft(x)               # length N//2 + 1
fr = np.fft.rfftfreq(N, d=1/Fs)   # matching one-sided frequencies
\`\`\`

This is the idiomatic Python approach for real-valued data. If you need an exact port of MATLAB's behavior (full spectrum), stay with \`np.fft.fft\`; if you're computing a one-sided amplitude spectrum, \`rfft\` is cleaner and you won't have to slice off the mirror image yourself.`,
    },
    {
      heading: 'Convert your FFT code automatically',
      body: `The MATLAB-to-Python [converter](/convert) maps \`fft\`, \`ifft\`, \`fft2\`, \`fftshift\`, and \`abs\` to their \`numpy.fft\` equivalents automatically, and adds the \`import numpy as np\` for you.

Paste a block of MATLAB signal-processing code into the [converter](/convert) and get runnable NumPy/SciPy back — \`fft\`, \`butter\`, \`filter\`, and \`findpeaks\` all map across in one pass.`,
    },
  ],
}
