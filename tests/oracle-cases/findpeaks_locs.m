% Self-contained: two-output findpeaks — peak values AND locations.
x = [0 2 0 5 0 3 0];
[pks, locs] = findpeaks(x);
vals = x(locs);
fprintf('n=%d sum=%d\n', numel(pks), sum(vals));
