import numpy as np
import scipy.signal as signal

# Signal Processing Toolbox: butter + filter + fft + findpeaks
fs = 100
t = np.linspace(0, 1, fs)
x = np.sin(2*np.pi*5*t) + 0.5 * np.sin(2*np.pi*20*t)
b, a = signal.butter(4, 0.3)
y = signal.lfilter(b, a, x)
Y = np.abs(np.fft.fft(y))
locs = signal.find_peaks(x)[0]
pks = x[locs]
print(f'peaks={int(len(pks)):d}')
