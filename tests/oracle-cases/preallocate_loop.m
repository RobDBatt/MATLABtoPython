% Self-contained: preallocate a row vector, fill in a loop, reduce.
n = 5;
z = zeros(1, n);
for i = 1:n
    z(i) = i^2;
end
total = sum(z);
fprintf('total=%d len=%d\n', total, length(z));
