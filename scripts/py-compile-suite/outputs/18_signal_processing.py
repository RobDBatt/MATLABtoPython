import numpy as np
import scipy.signal as signal

# Signal processing toolbox
fs = 1000
t = np.arange(0, 1 + 1/fs, 1/fs)
x = np.sin(2*np.pi*50*t) + 0.5*np.random.randn(t.shape)
b, a = signal.butter(4, 100/(fs/2))
y = signal.filtfilt(b, a, x)
N = np.max(x.shape)
X = np.fft.fft(x)
f = fs*(np.arange(0, (N/2) + 1))/N
P = np.abs(X/N)
