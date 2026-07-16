import numpy as np
import scipy.signal as signal

# findpeaks values + locations
x = np.array([0, 2, 0, 4, 0, 6, 0])
locs = signal.find_peaks(x)[0]
pks = x[locs]
print(f'{int(len(pks)):d}')
