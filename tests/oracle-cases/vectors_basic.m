% Self-contained: vector creation, elementwise ops, reduction.
v = [1 2 3 4 5];
w = v .* 2 + 1;
s = sum(w);
m = mean(v);
fprintf('sum=%d mean=%.1f\n', s, m);
