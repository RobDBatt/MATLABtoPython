import numpy as np

# logical indexing
v = np.array([5, -3, 8, -1, 2])
p = v[v > 0]
print(f'{int(len(p)):d}')
