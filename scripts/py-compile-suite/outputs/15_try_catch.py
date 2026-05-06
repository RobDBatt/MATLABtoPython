import numpy as np

# Try/catch
try:
    x = 1 / 0
    y = np.sqrt(-1)
except Exception as err:
    print('caught error')
    print(str(err))
