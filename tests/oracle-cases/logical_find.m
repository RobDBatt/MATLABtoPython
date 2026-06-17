% Self-contained: logical mask + find + logical indexing.
v = [3 8 1 9 4 7];
idx = find(v > 5);
big = v(v > 5);
fprintf('count=%d first=%d sum=%d\n', numel(idx), idx(1), sum(big));
