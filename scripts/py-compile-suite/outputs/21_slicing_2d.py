import numpy as np

# 2D slicing and reshaping
A = np.arange(1, 24 + 1).reshape([4, 6])
row1 = A[0, :]
col2 = A[:, 1]
submat = A(np.arange(1, 2 + 1), np.arange(3, 5 + 1))
last_row = A[ - 1, :]
last_col = A[:,  - 1]
A_flat = A.flatten(order="F")
