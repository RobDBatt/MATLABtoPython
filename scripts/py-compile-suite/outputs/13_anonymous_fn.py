# Anonymous functions and function handles
square = lambda x: x**2
cube = lambda x: x**3
linear = lambda a, b, x: a*x + b
y = square[4]
z = cube[2]
w = linear[1, 0, 9]
quad = lambda x: x**2 + 3*x + 2
