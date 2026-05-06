import numpy as np

# Logical operators
a = 5
b = 10
if a > 0 and b > 0:
    print('both positive')
if a < 0 or b < 0:
    print('one negative')
if not (a == b):
    print('not equal')
mask = np.arange(1, 10 + 1) > 5
selected = mask & (np.mod(np.arange(1, 10 + 1), 2) == 0)
