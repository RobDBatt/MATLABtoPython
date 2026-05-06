import numpy as np

# The tricky case: fprintf with format specifiers + transpose in same statement
A = np.array([[1, 2, 3], [4, 5, 6]])
v = np.array([[10], [20], [30]])
print('A size: %d x %d\n', A.shape)
print('column vector: %s' % (mat2str(v),))
row = v.T
print('row vector: %s' % (mat2str(row),))
B = A.T
print('transposed A has %d rows' % (B.shape[0],))
result = A*v
print('product = [%d, %d]' % (result[0], result[1]))
