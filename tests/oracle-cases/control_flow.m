% Self-contained: if / elseif / else and while.
n = 7;
if mod(n, 2) == 0
    label = 'even';
else
    label = 'odd';
end
k = 0;
while k < n
    k = k + 1;
end
fprintf('%s k=%d\n', label, k);
