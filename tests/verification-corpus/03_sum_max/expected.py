import numpy as np

# sum, max (value + index)
v = np.array([3, 1, 4, 1, 5, 9, 2, 6])
s = np.sum(v)
m = np.max(v)
mx, ix = np.amax(v), np.argmax(v)
print(f'{s:d} {m:d}')
