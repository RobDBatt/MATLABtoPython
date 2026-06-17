% Self-contained: findpeaks with a Name/Value option (MinPeakHeight → height=).
x = [0 1 0 5 0 3 0 8 0];
pks = findpeaks(x, 'MinPeakHeight', 4);
fprintf('n=%d max=%d\n', numel(pks), max(pks));
