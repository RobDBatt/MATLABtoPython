import type { Metadata } from 'next'
import { DebugWidget } from './debug-widget'

export const metadata: Metadata = {
  title: 'Converter Debug View — MATLAB to Python',
  description:
    'Inspect the MATLAB-to-Python conversion pipeline: side-by-side output, flags pinned to source lines, imports detected, toolboxes identified. See exactly how your MATLAB becomes Python.',
}

const EXAMPLE_MATLAB = `% Paste MATLAB here to inspect how it converts.
function y = demo(x, n)
    y = zeros(size(x));
    for i = 1:n
        y(i) = x(end - i + 1);
    end
    if ~isempty(y)
        y = y(:);
    end
end`

export default function DebugPage() {
  return (
    <div className="mx-auto max-w-[1800px] px-4 py-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="font-[family-name:var(--font-syne)] text-2xl font-bold text-slate-900">
          Converter Debug View
        </h1>
        <span className="text-xs text-slate-500">
          See every flag, import, and line-level decision the converter made.
        </span>
      </div>
      <DebugWidget exampleCode={EXAMPLE_MATLAB} />
    </div>
  )
}
