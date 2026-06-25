% filter — 2-tap moving average
b = [1 1] / 2;
a = 1;
x = [1 2 3 4];
y = filter(b, a, x);
fprintf('%g\n', y(2));
