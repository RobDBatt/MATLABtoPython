% elementwise multiply/divide/power
a = [1 2 3];
b = [4 5 6];
c = a .* b;
d = a ./ b;
e = a .^ 2;
fprintf('%g\n', c(1));
