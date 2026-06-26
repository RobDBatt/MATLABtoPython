% any, all, isfinite
v = [1 2 Inf];
f = isfinite(v);
a = any(v > 1);
b = all(v > 0);
fprintf('%d\n', a);
