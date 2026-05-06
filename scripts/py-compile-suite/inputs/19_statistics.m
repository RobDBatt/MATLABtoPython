% Descriptive statistics
x = randn(1000, 1);
mu = mean(x);
sigma = std(x);
med = median(x);
mn = min(x);
mx = max(x);
pct = prctile(x, [25, 50, 75]);
v = var(x);
