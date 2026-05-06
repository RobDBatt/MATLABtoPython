% Anonymous functions and function handles
square = @(x) x.^2;
cube = @(x) x.^3;
linear = @(a, b, x) a*x + b;
y = square(5);
z = cube(3);
w = linear(2, 1, 10);
quad = @(x) x.^2 + 3*x + 2;
