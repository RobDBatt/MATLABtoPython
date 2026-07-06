import numpy as np

# log2, nextpow2
a = np.log2(8)
b = int(np.ceil(np.log2(1000)))
print(f'{a:g} {b:g}')
