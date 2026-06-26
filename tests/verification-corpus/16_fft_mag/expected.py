import numpy as np

# fft magnitude spectrum
t = np.linspace(0, 1, 8)
x = np.sin(2*np.pi*2*t)
Y = np.fft.fft(x)
P = np.abs(Y)
print('%d' % (len(P),))
