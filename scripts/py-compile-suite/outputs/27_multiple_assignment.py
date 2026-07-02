import numpy as np

# Multiple return value unpacking
A = magic(5)
m, n = np.atleast_2d(A).shape
max_val, max_idx = np.max(A.flatten(order="F"))
min_val, min_idx = np.min(A.flatten(order="F"))
U, S, V = np.linalg.svd(A)
peak_idx = np.argmax[A[0, :]]
