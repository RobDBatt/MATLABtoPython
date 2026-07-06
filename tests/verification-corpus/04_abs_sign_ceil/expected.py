import numpy as np

# abs, sign, ceil
x = np.array([-2.5, 3.2, -1])
a = np.abs(x)
g = np.sign(x)
c = np.ceil(x)
print(f'{a[0]:g}')
