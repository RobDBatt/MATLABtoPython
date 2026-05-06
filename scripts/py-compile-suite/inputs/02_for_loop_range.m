% Classic for loop with range
n = 10;
total = 0;
for i = 1:n
    total = total + i;
end
for j = 1:2:20
    disp(j);
end
for k = n:-1:1
    total = total + k^2;
end
