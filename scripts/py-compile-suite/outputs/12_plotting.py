import numpy as np
import matplotlib.pyplot as plt

# Plotting with matplotlib-equivalent features
t = np.linspace(0, 2*np.pi, 200)
y1 = np.sin(t)
y2 = np.cos(t)
plt.figure()
plt.plot(t, y1, 'b', linewidth=1.5)
# hold on removed — matplotlib accumulates plots by default
plt.plot(t, y2, 'r--', linewidth=1.5)
plt.xlabel('t')
plt.ylabel('amplitude')
plt.title('Sine and Cosine')
plt.legend('sin' + 'cos', loc='best')
plt.grid(True)
