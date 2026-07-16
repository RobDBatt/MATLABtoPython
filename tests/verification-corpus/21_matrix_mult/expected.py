import numpy as np

# matrix multiply (MATLAB * is matmul on matrices)
A = np.array([[1, 2], [3, 4]])
B = np.array([[5, 6], [7, 8]])
C = A @ B
print(f'{int(C[0, 0]):d}')
