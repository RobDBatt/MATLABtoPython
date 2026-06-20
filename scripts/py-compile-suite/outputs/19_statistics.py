import numpy as np

# Descriptive statistics
x = np.random.randn(1000)
mu = np.mean(x)
sigma = np.std(x, ddof=1)
med = np.median(x)
mn = np.min(x)
mx = np.max(x)
pct = np.percentile(x, [25, 50, 75])
v = np.var(x, ddof=1)
