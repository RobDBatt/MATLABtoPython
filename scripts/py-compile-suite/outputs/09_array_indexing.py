import numpy as np

# Array indexing with end and colon
v = np.arange(1, 100 + 1)
first = v[0]
last = v[-1]
middle = v[49]
front = v[1:10]
tail = v[-9:]
every_other = v[1:2:]
reversed = v[::-1]
