import numpy as np

# any, all, isfinite
v = np.array([1, 2, np.inf])
f = np.isfinite(v)
a = np.any(v > 1)
b = np.all(v > 0)
print(f'{int(a):d}')
