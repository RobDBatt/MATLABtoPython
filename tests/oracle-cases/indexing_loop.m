% Self-contained: 1-based indexing inside a loop, end keyword.
x = [10 20 30 40];
acc = 0;
for i = 1:length(x)
    acc = acc + x(i);
end
last = x(end);
fprintf('acc=%d last=%d\n', acc, last);
