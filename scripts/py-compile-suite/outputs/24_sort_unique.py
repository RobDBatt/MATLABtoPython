import numpy as np
from matlabtopython_compat import sort_with_index

# Sort and unique
x = np.array([5, 3, 8, 1, 9, 3, 5, 2, 8])
sorted_asc = np.sort(x)
sorted_desc = np.sort(x, 'descend')
sorted_vals, idx = sort_with_index(x)
unique_vals = np.unique(x)
n_unique = np.max(unique_vals.shape)
