import numpy as np
import scipy.signal as signal

# filter — 2-tap moving average
b = np.array([1, 1]) / 2
a = 1
x = np.array([1, 2, 3, 4])
y = signal.lfilter(b, a, x)
print(f'{y[1]:g}')
