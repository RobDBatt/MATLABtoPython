# Anonymous functions and function handles
square = lambda x: x**2
cube = lambda x: x**3
linear = lambda a, b, x: a*x + b
y = square(5)
z = cube(3)
w = linear(2, 1, 10)
quad = lambda x: x**2 + 3*x + 2
