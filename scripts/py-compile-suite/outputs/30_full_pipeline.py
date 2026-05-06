import numpy as np
import scipy.signal as _signal
import matplotlib.pyplot as plt

def findpeaks_demo(signal, fs, threshold):
    # Find local peaks above a threshold
    N = np.max(signal.shape)
    dt = 1/fs
    t = np.arange(0, N-1 + 1) * dt

    # Smooth with a lowpass filter
    b, a = _signal.butter(4, 0.3)
    filtered = _signal.filtfilt(b, a, signal)

    # Scan for local maxima above threshold
    peaks = []
    locs = []
    for i in range(2, N-1 + 1):
        if filtered[i - 1] > filtered[i-1] and filtered[i - 1] > filtered[i+1]:
            if filtered[i - 1] > threshold:
                peaks.append(filtered[i - 1])
                locs.append(t[i - 1])

    # Plot the result
    plt.figure()
    plt.plot(t, signal, 'b', linewidth=0.5)
    # hold on removed — matplotlib accumulates plots by default
    plt.plot(locs, peaks, 'rv', markersize=8)
    plt.title('Found %d peaks above %.2f' % (np.max(peaks.shape), threshold))
    plt.xlabel('Time (s)')
    plt.ylabel('Amplitude')
    plt.grid(True)
    plt.legend(['Signal', 'Peaks'], loc='best')
    return peaks, locs
