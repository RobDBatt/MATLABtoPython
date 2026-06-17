% Self-contained: peak VALUES of a simple signal, then reduce.
x = [0 2 0 5 0 3 0];
pks = findpeaks(x);
fprintf('npeaks=%d max=%d\n', numel(pks), max(pks));
