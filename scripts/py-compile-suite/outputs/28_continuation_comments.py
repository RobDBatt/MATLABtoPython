import numpy as np

#% Section A: Setup
# Initialize parameters
N = 1000
# number of samples
fs = 44100
# sample rate in Hz
f = 440
# frequency in Hz

#% Section B: Generate signal
t = np.arange(0, N-1 + 1) / fs
signal = np.sin(2*np.pi*f*t) + 0.5*np.sin(2*np.pi*2*f*t) + 0.25*np.sin(2*np.pi*3*f*t)

#% Section C: Compute RMS
rms_val = np.sqrt(np.mean(signal**2))
