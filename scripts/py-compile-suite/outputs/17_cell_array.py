import numpy as np

# Cell arrays
names = 'Alice' + 'Bob' + 'Carol'
first_name = names[0]
n = np.max(names.shape)
for i in range(1, n + 1):
    print(names[i - 1])
