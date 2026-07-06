import type { Metadata } from 'next'
import { ConverterWidget } from './converter-widget'

export const metadata: Metadata = {
  title: 'Convert MATLAB to Python',
  description:
    'Paste your MATLAB code and get deterministic Python output. Toolbox-aware, with a compatibility report showing exactly what was converted and what needs review.',
}

const EXAMPLE_MATLAB = `% Example: Basic signal analysis
function [result, freq] = analyze_signal(x, fs)
    N = length(x);

    % Apply Hanning window
    w = hanning(N);
    xw = x .* w;

    % Compute FFT
    X = fft(xw, N);
    X = abs(X(1:N/2));

    % Frequency axis
    freq = linspace(0, fs/2, N/2);

    % Find peak frequency
    [~, idx] = max(X);
    peak_freq = freq(idx);

    fprintf('Peak frequency: %f Hz\\n', peak_freq);

    % Plot
    figure
    plot(freq, X)
    title('Frequency Spectrum')
    xlabel('Frequency (Hz)')
    ylabel('Magnitude')
    grid on

    result = X;
end`

export default function ConvertPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-syne)] text-3xl font-bold text-[#eef0f4] mb-2">
          Convert MATLAB to Python
        </h1>
        <p className="text-[#9aa1ac] text-sm">
          Deterministic conversion. No AI. Same input, same output, every time.
          <span className="text-[#5a5f6b]"> Free tier: 50 lines.</span>
        </p>
      </div>

      <ConverterWidget exampleCode={EXAMPLE_MATLAB} />
    </div>
  )
}
