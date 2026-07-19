import numpy as np

# length, class
v = np.arange(1, 7 + 1)
n = np.max(v.shape)
c = type(v).__name__
print(f'{int(n):d}')
