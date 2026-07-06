import numpy as np

# sin over linspace
t = np.linspace(0, 2*np.pi, 5)
y = np.sin(t)
print(f'{y[1]:g}')
