% Self-contained: common math + max with index return.
v = [4 9 2 16 25];
roots = sqrt(v);
[mx, pos] = max(v);
fprintf('max=%d at=%d rootsum=%.2f\n', mx, pos, sum(roots));
