% Self-contained: matrix construction, transpose, multiply, size.
A = [1 2; 3 4];
B = A';
C = A * B;
[r, c] = size(C);
fprintf('rows=%d cols=%d total=%d\n', r, c, sum(C(:)));
