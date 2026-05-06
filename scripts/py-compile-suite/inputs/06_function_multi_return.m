function [mu, sigma, n] = describe(x)
    mu = mean(x);
    sigma = std(x);
    n = length(x);
end
