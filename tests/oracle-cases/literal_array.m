% Self-contained: a matrix literal used only by indexing/reduction (no other
% numpy call). The np.array wrapping must still pull in the numpy import.
v = [10 20 30 40];
s = 0;
for i = 1:4
    s = s + v(i);
end
fprintf('s=%d\n', s);
