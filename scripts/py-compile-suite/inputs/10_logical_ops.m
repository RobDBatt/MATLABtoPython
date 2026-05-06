% Logical operators
a = 5;
b = 10;
if a > 0 && b > 0
    disp('both positive');
end
if a < 0 || b < 0
    disp('one negative');
end
if ~(a == b)
    disp('not equal');
end
mask = (1:10) > 5;
selected = mask & (mod(1:10, 2) == 0);
