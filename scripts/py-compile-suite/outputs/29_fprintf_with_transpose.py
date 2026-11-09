import numpy as np

# The tricky case: fprintf with format specifiers + transpose in same statement
A = np.array([[1, 2, 3], [4, 5, 6]])
v = np.vstack([10, 20, 30])
print('A size: %d x %d\n', A.shape)
print(f'column vector: {mat2str(v)}')
row = v.T
print(f'row vector: {mat2str(row)}')
B = A.T
print(f'transposed A has {int(B.shape[0]):d} rows')
result = A@v
print(f'product = [{int(result[0]):d}, {int(result[1]):d}]')
