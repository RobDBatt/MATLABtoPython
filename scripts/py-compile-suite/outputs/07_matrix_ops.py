import numpy as np

# Matrix operations with transpose
A = np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]])
B = A.T
C = A @ B
D = A + A
E = A - np.eye(3)
F = np.linalg.solve(A, np.ones(3))
trace_val = np.trace(A)
det_val = np.linalg.det(A)
