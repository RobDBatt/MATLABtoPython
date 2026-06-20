import numpy as np

# Find indices
x = np.array([1, -2, 3, -4, 5, -6, 7])
positive_idx = np.flatnonzero(x > 0)
first_neg = np.flatnonzero(x < 0)[0]
last_neg = np.flatnonzero(x < 0)[-1]
positive_vals = x[positive_idx - 1]
count_pos = np.max(positive_idx.shape)
