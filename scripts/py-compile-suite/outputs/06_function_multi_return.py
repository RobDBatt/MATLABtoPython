import numpy as np

def describe(x):
    mu = np.mean(x)
    sigma = np.std(x, ddof=1)
    n = np.max(x.shape)
    return mu, sigma, n
