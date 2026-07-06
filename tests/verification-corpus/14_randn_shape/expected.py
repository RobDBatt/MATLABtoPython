import numpy as np

# randn (non-deterministic) -> shape/finite only
R = np.random.randn(2, 3)
print(f'{len(R):d}')
