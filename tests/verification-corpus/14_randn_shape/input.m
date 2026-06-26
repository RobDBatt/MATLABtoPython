% randn (non-deterministic) -> shape/finite only
R = randn(2, 3);
fprintf('%d\n', numel(R));
