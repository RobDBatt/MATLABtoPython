import numpy as np

# Multiple return value unpacking
A = magic(5)
m, n = np.atleast_2d(A).shape
A = np.atleast_2d(A)
max_val, max_idx = np.amax(A.flatten(order="F")), np.argmax(A.flatten(order="F"))
min_val, min_idx = np.amin(A.flatten(order="F")), np.argmin(A.flatten(order="F"))
U, S, V = np.linalg.svd(A)
peak_idx = np.argmax(A[0:0+1, :])
