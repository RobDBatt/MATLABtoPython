import numpy as np

# Array indexing with end and colon
v = np.arange(1, 100 + 1)
first = v[0]
last = v[-1]
middle = v[49]
front = v[0:10]
tail = v[-10:]
every_other = v[0::2]
reversed = v[::-1]
